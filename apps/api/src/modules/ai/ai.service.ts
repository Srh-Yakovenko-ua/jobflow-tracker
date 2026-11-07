import {
  AI_KIND_SCHEMAS,
  AI_PROMPT_VERSIONS,
  type AiKind,
  type AiKindOutput,
} from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnrecoverableError } from 'bullmq';

import { Clock } from '../../common/clock.js';
import type { Env } from '../../config/env.js';
import type { jobFields } from '../../queues/processed-job.js';
import { AI_JOB_ERRORS, type AiCompleteJob } from './ai.jobs.js';
import { AiRepository } from './ai.repository.js';
import { type AiQueuePosition, budgetWindow, queueEstimate } from './ai-budget.js';
import { AiClient } from './ai-client.js';
import { aiInputHash } from './ai-input-hash.js';
import { AiPayloadError, privatePayloadPaths } from './ai-payload-guard.js';
import { AiServiceError } from './ai-service-error.js';

export type AiCompleteAttempt = {
  job: AiCompleteJob;
  finalAttempt: boolean;
  logFields: ReturnType<typeof jobFields>;
};

export type AiOutcome = { aiResultId: string; output: AiKindOutput<AiKind>; cached: boolean };

export type AiJobOfUser = { userId: string; aiJobId: string };

type AiRun = AiCompleteAttempt & { now: Date; inputHash: string };

const FAILED_CALL = {
  status: 'failed',
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
    const run = { ...attempt, now, inputHash: aiInputHash(attempt.job) };
    return (await this.fromCache(run)) ?? this.callWithinBudget(run);
  }

  async queuePosition({ userId, aiJobId }: AiJobOfUser): Promise<AiQueuePosition | null> {
    const sample = await this.repository.queueSample(userId, aiJobId);
    return sample === null ? null : queueEstimate(sample);
  }

  deleteResults(userId: string): Promise<void> {
    return this.repository.deleteResults(userId);
  }

  private async fromCache(run: AiRun): Promise<AiOutcome | null> {
    const { aiJobId: id, userId, kind } = run.job;
    const cached = await this.repository.findCachedResult(userId, {
      kind,
      inputHash: run.inputHash,
    });
    if (cached === null) {
      return null;
    }
    const output = AI_KIND_SCHEMAS[kind].output.parse(cached.output);
    await this.repository.finishJob(userId, { id, aiResultId: cached.id, now: run.now });
    this.logger.log(traceOf(run), 'ai cache hit');
    return { aiResultId: cached.id, output, cached: true };
  }

  private async callWithinBudget(run: AiRun): Promise<AiOutcome> {
    const { aiJobId: id, userId } = run.job;
    const usage = await this.repository.budgetUsage(userId, budgetWindow(run.now));
    if (usage.calls < this.budget.dailyCalls && usage.tokens < this.budget.monthlyTokens) {
      return this.call(run);
    }
    const errorType = AI_JOB_ERRORS.budgetExceeded;
    await this.repository.failJob(userId, { id, errorType, now: run.now });
    this.logger.warn({ ...traceOf(run), ...usage }, 'ai budget exceeded');
    throw new UnrecoverableError(errorType);
  }

  private async call(run: AiRun): Promise<AiOutcome> {
    const { job, inputHash, now } = run;
    const { aiJobId: id, userId, kind, input, requestId } = job;
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
      ...meta,
    } as const;
    const aiResultId = await this.repository.saveResult(userId, succeeded);
    await this.repository.finishJob(userId, { id, aiResultId, now });
    this.logger.log({ ...traceOf(run), ...meta }, 'ai completion done');
    return { aiResultId, output, cached: false };
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

  private async recordFailure({ job, inputHash, now }: AiRun, errorType: string): Promise<void> {
    const { aiJobId: id, userId, kind } = job;
    const promptVersion = AI_PROMPT_VERSIONS[kind];
    await this.repository.saveResult(userId, {
      kind,
      inputHash,
      promptVersion,
      error: errorType,
      ...FAILED_CALL,
    });
    await this.repository.failJob(userId, { id, errorType, now });
  }
}
