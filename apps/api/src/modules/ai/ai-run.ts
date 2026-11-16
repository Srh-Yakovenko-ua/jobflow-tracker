import type { AiKind, AiKindOutput, JobUpdated } from '@jobflow/shared';

import type { jobFields } from '../../queues/processed-job.js';
import type { AiCompleteJob } from './ai.jobs.js';
import type { SettledAiJob } from './ai-job-router.js';

export type AiCompleteAttempt = {
  job: AiCompleteJob;
  finalAttempt: boolean;
  retried: boolean;
  logFields: ReturnType<typeof jobFields>;
  settled: (outcome: SettledAiJob) => Promise<void>;
  progressed: (update: JobUpdated) => Promise<void>;
};

export type AiOutcome = { aiResultId: string; output: AiKindOutput<AiKind>; cached: boolean };

export type AiJobOfUser = { userId: string; aiJobId: string };

export type AiRun = AiCompleteAttempt & { now: Date; inputHash: string };

export type AiAnswer = Pick<AiOutcome, 'aiResultId' | 'output'>;

export type AiFailureNotice = { failed: number; errorType: string };

export function traceOf({ job, logFields }: AiCompleteAttempt) {
  return { requestId: job.requestId, ...logFields, aiJobId: job.aiJobId, kind: job.kind };
}
