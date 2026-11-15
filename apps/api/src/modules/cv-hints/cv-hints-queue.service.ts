import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QUEUES } from '../../queues/queues.js';
import { AiService, queueOrFailAiJob } from '../ai/index.js';
import type { CvHintsRequestedPayload } from './cv-hints.events.js';

@Injectable()
export class CvHintsQueueService {
  private readonly logger = new Logger(CvHintsQueueService.name);

  constructor(
    private readonly ai: AiService,
    @InjectQueue(QUEUES.ai.name) private readonly queue: Queue,
  ) {}

  async enqueue(requested: CvHintsRequestedPayload): Promise<void> {
    const guarded = { queue: this.queue, ai: this.ai, logger: this.logger };
    await queueOrFailAiJob(guarded, { kind: 'cv_hints', ...requested });
    const { aiJobId, applicationId, resumeVersionId, requestId } = requested;
    this.logger.log({ requestId, aiJobId, applicationId, resumeVersionId }, 'cv hints queued');
  }
}
