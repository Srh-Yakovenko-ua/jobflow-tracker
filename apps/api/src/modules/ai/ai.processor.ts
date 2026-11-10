import { LIVE_EVENTS } from '@jobflow/shared';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';

import { failedJobFields, jobFields, type ProcessedJob } from '../../queues/processed-job.js';
import { DEFAULT_JOB_OPTIONS, QUEUES } from '../../queues/queues.js';
import { LivePublisher } from '../live/index.js';
import { AI_JOBS, type AiCompleteJob, aiCompleteJobSchema } from './ai.jobs.js';
import { type AiOutcome, AiService } from './ai.service.js';
import { AiJobRouter } from './ai-job-router.js';

const failedJobSchema = aiCompleteJobSchema
  .pick({ aiJobId: true, kind: true, requestId: true })
  .partial();

@Processor(QUEUES.ai.name, { concurrency: QUEUES.ai.concurrency })
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(
    private readonly ai: AiService,
    private readonly router: AiJobRouter,
    private readonly live: LivePublisher,
  ) {
    super();
  }

  async process(job: ProcessedJob): Promise<AiOutcome | null> {
    const parsed = this.parse(job);
    return this.ai.complete({
      job: parsed,
      finalAttempt: job.attemptsMade + 1 >= DEFAULT_JOB_OPTIONS.attempts,
      logFields: jobFields(job),
      settled: (outcome) => this.router.route(outcome),
      progressed: (update) =>
        this.live.publish(parsed.userId, { type: LIVE_EVENTS.jobUpdated, data: update }),
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: ProcessedJob | undefined, error: Error): void {
    const { aiJobId, kind, requestId } = failedJobSchema.safeParse(job?.data).data ?? {};
    this.logger.warn({ requestId, aiJobId, kind, ...failedJobFields(job, error) }, 'ai job failed');
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
