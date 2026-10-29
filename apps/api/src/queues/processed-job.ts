import type { Job } from 'bullmq';

export type ProcessedJob = Pick<Job, 'id' | 'name' | 'queueName' | 'data' | 'attemptsMade'>;

export function jobFields(job: ProcessedJob) {
  return { jobId: job.id, queue: job.queueName, jobName: job.name };
}

export function failedJobFields(job: ProcessedJob | undefined, error: Error) {
  const fields = job === undefined ? {} : { ...jobFields(job), attemptsMade: job.attemptsMade };
  return { ...fields, err: error.message };
}
