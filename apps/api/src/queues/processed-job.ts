import type { Logger } from '@nestjs/common';
import { type Job, UnrecoverableError } from 'bullmq';
import type { z } from 'zod';

export type ProcessedJob = Pick<Job, 'id' | 'name' | 'queueName' | 'data' | 'attemptsMade'>;

export type JobContract<Data> = {
  name: string;
  schema: z.ZodType<Data>;
  logger: Logger;
  label: string;
};

export type WorkerFailure = { queue: string; error: Error };

export function jobFields(job: ProcessedJob) {
  return { jobId: job.id, queue: job.queueName, jobName: job.name };
}

export function failedJobFields(job: ProcessedJob | undefined, error: Error) {
  const fields = job === undefined ? {} : { ...jobFields(job), attemptsMade: job.attemptsMade };
  return { ...fields, err: error.message };
}

export function parsedJob<Data>(job: ProcessedJob, contract: JobContract<Data>): Data {
  const parsed = contract.schema.safeParse(job.data);
  if (job.name !== contract.name || !parsed.success) {
    const message = `${contract.label} invalid`;
    contract.logger.error({ ...jobFields(job), issues: parsed.error?.issues }, message);
    throw new UnrecoverableError(message);
  }
  return parsed.data;
}

export function warnWorkerError(logger: Logger, { queue, error }: WorkerFailure): void {
  logger.warn({ queue, err: error.message }, 'worker connection error');
}
