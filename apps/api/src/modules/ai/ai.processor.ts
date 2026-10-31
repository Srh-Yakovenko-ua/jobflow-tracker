import type { AiCompletion, AiKind } from '@jobflow/shared';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';

import { failedJobFields, jobFields, type ProcessedJob } from '../../queues/processed-job.js';
import { QUEUES } from '../../queues/queues.js';
import { AI_JOBS, type AiCompleteJob, aiCompleteJobSchema } from './ai.jobs.js';
import { AiClient } from './ai-client.js';
import { AiServiceError } from './ai-service-error.js';

const failedJobSchema = aiCompleteJobSchema.pick({ kind: true, requestId: true }).partial();

function isFinal(error: unknown): error is AiServiceError {
  return (
    error instanceof AiServiceError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 429
  );
}

@Processor(QUEUES.ai.name, { concurrency: QUEUES.ai.concurrency })
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(private readonly ai: AiClient) {
    super();
  }

  async process(job: ProcessedJob): Promise<AiCompletion<AiKind>> {
    const { kind, input, requestId } = this.parse(job);
    const completion = await this.ai
      .complete({ kind, input, requestId })
      .catch((error: unknown) => {
        throw isFinal(error) ? new UnrecoverableError(error.message) : error;
      });
    const { model, promptVersion, tokensIn, tokensOut, latencyMs } = completion;
    this.logger.log(
      { requestId, ...jobFields(job), kind, model, promptVersion, tokensIn, tokensOut, latencyMs },
      'ai completion done',
    );
    return completion;
  }

  @OnWorkerEvent('failed')
  onFailed(job: ProcessedJob | undefined, error: Error): void {
    const { kind, requestId } = failedJobSchema.safeParse(job?.data).data ?? {};
    this.logger.warn({ requestId, kind, ...failedJobFields(job, error) }, 'ai job failed');
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.warn({ queue: QUEUES.ai.name, err: error.message }, 'worker connection error');
  }

  private parse(job: ProcessedJob): AiCompleteJob {
    const parsed = aiCompleteJobSchema.safeParse(job.data);
    if (job.name !== AI_JOBS.complete || !parsed.success) {
      this.logger.error({ ...jobFields(job), issues: parsed.error?.issues }, 'ai job invalid');
      throw new UnrecoverableError('ai job invalid');
    }
    return parsed.data;
  }
}
