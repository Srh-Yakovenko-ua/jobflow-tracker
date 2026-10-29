import type { ProcessedJob } from '../queues/processed-job.js';

export type ProcessedJobFields = Pick<ProcessedJob, 'queueName' | 'name'> & {
  data: unknown;
  id?: string;
};

export function processedJob({ id = '1', ...fields }: ProcessedJobFields): ProcessedJob {
  return { id, attemptsMade: 0, ...fields };
}
