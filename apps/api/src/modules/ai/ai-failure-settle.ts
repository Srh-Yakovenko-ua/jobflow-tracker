import type { Logger } from '@nestjs/common';

import type { AiRepository } from './ai.repository.js';
import { type AiCompleteAttempt, type AiRun, traceOf } from './ai-run.js';

export type FailureSettle = {
  repository: AiRepository;
  run: Pick<AiRun, 'job' | 'now' | 'settled'>;
  errorType: string;
};

export type StoredFailureSettle = {
  repository: AiRepository;
  attempt: AiCompleteAttempt;
  now: Date;
  logger: Logger;
};

export async function settleFailure({ repository, run, errorType }: FailureSettle): Promise<void> {
  const { job, now } = run;
  await run.settled({ job, status: 'failed', errorType });
  await repository.markFailureSettled(job.userId, { id: job.aiJobId, now });
}

export async function settleStoredFailure({
  repository,
  attempt,
  now,
  logger,
}: StoredFailureSettle): Promise<void> {
  const { job } = attempt;
  const errorType = await repository.findUnsettledFailure(job.userId, job.aiJobId);
  if (errorType === null) {
    logger.log(traceOf(attempt), 'ai job skipped');
    return;
  }
  await settleFailure({ repository, run: { ...attempt, now }, errorType });
  logger.log(traceOf(attempt), 'ai failed job settled again');
}
