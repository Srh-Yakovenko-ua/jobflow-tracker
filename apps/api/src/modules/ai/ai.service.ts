import {
  AI_JOB_FAILURES,
  AI_KIND_SCHEMAS,
  AI_PROMPT_VERSIONS,
  type AiKind,
  type AiKindOutput,
  type JobUpdated,
  vacancyParseFailure,
  vacancyParseOutputSchema,
} from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnrecoverableError } from 'bullmq';

import { Clock } from '../../common/clock.js';
import type { Env } from '../../config/env.js';
import type { jobFields } from '../../queues/processed-job.js';
import type { AiCompleteJob } from './ai.jobs.js';
import { AiRepository, type CreateAiJob } from './ai.repository.js';
import { budgetWindow } from './ai-budget.js';
import { AiClient } from './ai-client.js';
import { aiInputHash } from './ai-input-hash.js';
import type { SettledAiJob } from './ai-job-router.js';
import { jobUpdateOf } from './ai-job-update.js';
import { AiPayloadError, privatePayloadPaths } from './ai-payload-guard.js';
import { type AiQueuePosition, queueEstimate } from './ai-queue-estimate.js';
import { AiServiceError } from './ai-service-error.js';

export type AiCompleteAttempt = {
  job: AiCompleteJob;
  finalAttempt: boolean;
  logFields: ReturnType<typeof jobFields>;
  settled: (outcome: SettledAiJob) => Promise<void>;
  progressed: (update: JobUpdated) => Promise<void>;
};

export type AiOutcome = { aiResultId: string; output: AiKindOutput<AiKind>; cached: boolean };

export type AiJobOfUser = { userId: string; aiJobId: string };

type AiRun = AiCompleteAttempt & { now: Date; inputHash: string };

type AiAnswer = Pick<AiOutcome, 'aiResultId' | 'output'>;

const OUTPUT_FAILURES: Record<AiKind, (output: unknown) => string | null> = {
  vacancy_parse: (output) => vacancyParseFailure(vacancyParseOutputSchema.parse(output)),
};

const FAILED_CALL = {
  model: '',
  tokensIn: 0,
  tokensOut: 0,
  latencyMs: 0,
} as const;

function isFinal(error: AiServiceError): boolean {
  return error.status >= 400 && error.status < 500 && error.status !== 429;
}

function traceOf({ job, logFields }: AiCompleteAttempt) {
  return { requestId: job.requestId, ...logFields, aiJobId: job.aiJobId, kind: job.kind };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private readonly budget: { dailyCalls: number; monthlyTokens: number };

  private readonly inProduction: boolean;

  constructor(
    private readonly repository: AiRepository,
    private readonly ai: AiClient,
    private readonly clock: Clock,
    config: ConfigService<Env, true>,
  ) {
    this.budget = {
      dailyCalls: config.get('AI_DAILY_LIMIT', { infer: true }),
      monthlyTokens: config.get('AI_MONTHLY_TOKEN_CAP', { infer: true }),
    };
    this.inProduction = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  async complete(attempt: AiCompleteAttempt): Promise<AiOutcome | null> {
    const { aiJobId: id, userId } = attempt.job;
    const now = this.clock.now();
    if ((await this.repository.startJob(userId, { id, now })) === 0) {
      this.logger.log(traceOf(attempt), 'ai job skipped');
      return null;
    }
    await attempt.progressed(jobUpdateOf({ job: attempt.job, status: 'processing' }));
    const run = { ...attempt, now, inputHash: aiInputHash(attempt.job) };
    return (await this.fromCache(run)) ?? this.callWithinBudget(run);
  }

  createJob(userId: string, job: CreateAiJob): Promise<string> {
    return this.repository.createJob(userId, job);
  }

  async queuePosition({ userId, aiJobId }: AiJobOfUser): Promise<AiQueuePosition | null> {
    const sample = await this.repository.queueSample(userId, aiJobId);
    return sample === null ? null : queueEstimate(sample);
  }

  deleteResults(userId: string): Promise<void> {
    return this.repository.deleteResults(userId);
  }

  private async fromCache(run: AiRun): Promise<AiOutcome | null> {
    const { userId, kind } = run.job;
    const cached = await this.repository.findCachedResult(userId, {
      kind,
      inputHash: run.inputHash,
    });
    if (cached === null) {
      return null;
    }
    const output = AI_KIND_SCHEMAS[kind].output.parse(cached.output);
    await this.finish(run, { aiResultId: cached.id, output });
    this.logger.log(traceOf(run), 'ai cache hit');
    return { aiResultId: cached.id, output, cached: true };
  }

  private async callWithinBudget(run: AiRun): Promise<AiOutcome> {
    const usage = await this.repository.budgetUsage(run.job.userId, budgetWindow(run.now));
    if (usage.calls < this.budget.dailyCalls && usage.tokens < this.budget.monthlyTokens) {
      return this.call(run);
    }
    const errorType = AI_JOB_FAILURES.budgetExceeded;
    await this.fail(run, errorType);
    this.logger.warn({ ...traceOf(run), ...usage }, 'ai budget exceeded');
    throw new UnrecoverableError(errorType);
  }

  private async call(run: AiRun): Promise<AiOutcome> {
    const { job, inputHash, now } = run;
    const { userId, kind, input, requestId } = job;
    this.guardPayload(run);
    const { output, ...meta } = await this.ai
      .complete({ kind, input, requestId })
      .catch((error: unknown) => this.refuse(run, error));
    const succeeded = {
      kind,
      inputHash,
      status: 'succeeded',
      error: null,
      output,
      now,
      ...meta,
    } as const;
    const aiResultId = await this.repository.saveResult(userId, succeeded);
    await this.finish(run, { aiResultId, output });
    this.logger.log({ ...traceOf(run), ...meta }, 'ai completion done');
    return { aiResultId, output, cached: false };
  }

  private async finish(run: AiRun, { aiResultId, output }: AiAnswer): Promise<void> {
    const { job, now, settled, progressed } = run;
    const failure = OUTPUT_FAILURES[job.kind](output);
    if (failure !== null) {
      await this.fail(run, failure);
      throw new UnrecoverableError(failure);
    }
    await settled({ job, status: 'done', output });
    await this.repository.finishJob(job.userId, { id: job.aiJobId, aiResultId, now });
    await progressed(jobUpdateOf({ job, status: 'done' }));
  }

  private async fail(run: AiRun, errorType: string): Promise<void> {
    const { job, now } = run;
    const failed = await this.repository.failJob(job.userId, { id: job.aiJobId, errorType, now });
    if (failed === 1) {
      await run.settled({ job, status: 'failed', errorType });
      await run.progressed(jobUpdateOf({ job, status: 'failed', errorType }));
    }
  }

  private guardPayload(run: AiRun): void {
    const paths = privatePayloadPaths(run.job.input);
    if (paths.length === 0) {
      return;
    }
    if (!this.inProduction) {
      throw new AiPayloadError(paths);
    }
    const warning = { ...traceOf(run), securityEvent: 'ai_payload_private_field', paths };
    this.logger.warn(warning, 'ai payload carried private fields');
  }

  private async refuse(run: AiRun, error: unknown): Promise<never> {
    if (!(error instanceof AiServiceError)) {
      throw error;
    }
    const final = isFinal(error);
    if (final || run.finalAttempt) {
      await this.recordFailure(run, error.type);
    }
    throw final ? new UnrecoverableError(error.message) : error;
  }

  private async recordFailure(run: AiRun, errorType: string): Promise<void> {
    const { job, inputHash, now } = run;
    const { userId, kind } = job;
    const promptVersion = AI_PROMPT_VERSIONS[kind];
    await this.repository.saveFailure(userId, {
      kind,
      inputHash,
      promptVersion,
      error: errorType,
      now,
      ...FAILED_CALL,
    });
    await this.fail(run, errorType);
  }
}
