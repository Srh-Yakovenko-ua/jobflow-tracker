import { AI_JOB_FAILURES, AI_KIND_SCHEMAS } from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnrecoverableError } from 'bullmq';

import { Clock } from '../../common/clock.js';
import { errorMessageOf } from '../../common/error-message.js';
import type { Env } from '../../config/env.js';
import { type AiJobFailure, AiRepository, type CreateAiJob } from './ai.repository.js';
import { budgetWindow } from './ai-budget.js';
import { AiClient } from './ai-client.js';
import { settleFailure, settleStoredFailure } from './ai-failure-settle.js';
import { failedCallOf, failedResultOf, isFinal, OUTPUT_FAILURES } from './ai-failures.js';
import { jobInputHash } from './ai-input-hash.js';
import { jobUpdateOf } from './ai-job-update.js';
import { AiPayloadError, privatePayloadPaths } from './ai-payload-guard.js';
import { type AiQueuePosition, queueEstimate } from './ai-queue-estimate.js';
import {
  type AiAnswer,
  type AiCompleteAttempt,
  type AiFailureNotice,
  type AiJobOfUser,
  type AiOutcome,
  type AiRun,
  traceOf,
} from './ai-run.js';
import { AI_SERVICE_ERRORS, AiServiceError, untypedAiError } from './ai-service-error.js';

export type { AiCompleteAttempt, AiJobOfUser, AiOutcome } from './ai-run.js';

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
      const { repository, logger } = this;
      await settleStoredFailure({ repository, attempt, now, logger });
      return null;
    }
    const run = { ...attempt, now, inputHash: jobInputHash(attempt.job) };
    try {
      await attempt.progressed(jobUpdateOf({ job: attempt.job, status: 'processing' }));
      return (
        (attempt.job.fresh ? null : await this.fromCache(run)) ?? (await this.callWithinBudget(run))
      );
    } catch (error) {
      await this.failLastAttempt(run);
      throw error;
    }
  }

  createJob(userId: string, job: CreateAiJob): Promise<string> {
    return this.repository.createJob(userId, job);
  }

  failJob(userId: string, { id, errorType }: AiJobFailure): Promise<number> {
    const now = this.clock.now();
    return this.repository.failJob(userId, { id, errorType, now, settledAt: now });
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
    const key = { kind, inputHash: run.inputHash };
    const cached = await this.repository.findCachedResult(userId, key);
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
    const { userId, kind, input, options, requestId } = job;
    await this.guardPayload(run);
    const { output, ...meta } = await this.ai
      .complete({ kind, input, options, requestId })
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
    await this.repository.recordCall(userId, { ...succeeded, errorType: null });
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
    const finished = await this.repository.finishJob(job.userId, {
      id: job.aiJobId,
      aiResultId,
      now,
    });
    if (finished === 1) {
      await progressed(jobUpdateOf({ job, status: 'done' }));
    } else {
      this.logger.log(traceOf(run), 'ai job not marked done');
    }
  }

  private async fail(run: AiRun, errorType: string): Promise<void> {
    const { job, now } = run;
    const failed = await this.repository.failJob(job.userId, { id: job.aiJobId, errorType, now });
    await this.announceFailure(run, { failed, errorType });
  }

  private async announceFailure(run: AiRun, { failed, errorType }: AiFailureNotice): Promise<void> {
    if (failed !== 1) {
      return;
    }
    const { job } = run;
    try {
      await settleFailure({ repository: this.repository, run, errorType });
    } finally {
      await run.progressed(jobUpdateOf({ job, status: 'failed', errorType }));
    }
  }

  private async failLastAttempt(run: AiRun): Promise<void> {
    if (!run.finalAttempt) {
      return;
    }
    await this.fail(run, AI_SERVICE_ERRORS.internal).catch((error: unknown) => {
      this.logger.warn({ ...traceOf(run), err: errorMessageOf(error) }, 'ai job not failed');
    });
  }

  private async guardPayload(run: AiRun): Promise<void> {
    const paths = privatePayloadPaths(run.job.input);
    if (paths.length === 0) {
      return;
    }
    if (!this.inProduction) {
      await this.fail(run, AI_SERVICE_ERRORS.internal);
      throw new AiPayloadError(paths);
    }
    const warning = { ...traceOf(run), securityEvent: 'ai_payload_private_field', paths };
    this.logger.warn(warning, 'ai payload carried private fields');
  }

  private async refuse(run: AiRun, error: unknown): Promise<never> {
    const typed = error instanceof AiServiceError ? error : untypedAiError(error);
    if (typed.reachedService) {
      await this.repository.recordCall(run.job.userId, failedCallOf(run, typed.type));
    }
    const final = isFinal({ error: typed, kind: run.job.kind });
    if (final || run.finalAttempt) {
      await this.recordFailure(run, typed.type);
    }
    throw final ? new UnrecoverableError(typed.message) : typed;
  }

  private async recordFailure(run: AiRun, errorType: string): Promise<void> {
    const { job, now } = run;
    const failed = await this.repository.failJobWithResult(job.userId, {
      result: failedResultOf(run, errorType),
      job: { id: job.aiJobId, errorType, now },
    });
    await this.announceFailure(run, { failed, errorType });
  }
}
