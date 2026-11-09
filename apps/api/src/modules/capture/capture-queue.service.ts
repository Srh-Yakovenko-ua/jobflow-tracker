import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue, UnrecoverableError } from 'bullmq';

import { withinLimit } from '../../common/probe.js';
import type { DomainEvent } from '../../outbox/domain-event-router.js';
import { OUTBOX_LIMITS } from '../../outbox/outbox-relay.service.js';
import { QUEUES } from '../../queues/queues.js';
import { AI_JOBS, AI_PAYLOAD_BUILDERS, type AiCompleteJob } from '../ai/index.js';
import {
  applicationCaptureRequestedPayloadSchema,
  ApplicationDraftsService,
} from '../applications/index.js';

@Injectable()
export class CaptureQueueService {
  private readonly logger = new Logger(CaptureQueueService.name);

  constructor(
    private readonly drafts: ApplicationDraftsService,
    @InjectQueue(QUEUES.ai.name) private readonly queue: Queue,
  ) {}

  async enqueue({ id, payload }: DomainEvent): Promise<void> {
    const parsed = applicationCaptureRequestedPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      this.logger.error({ eventId: id, issues: parsed.error.issues }, 'capture event invalid');
      throw new UnrecoverableError('capture event invalid');
    }
    const { userId, applicationId, aiJobId, requestId } = parsed.data;
    const rawText = await this.drafts.findRawText(userId, applicationId);
    if (rawText === null) {
      return;
    }
    const job: AiCompleteJob = {
      aiJobId,
      userId,
      kind: 'vacancy_parse',
      input: AI_PAYLOAD_BUILDERS.vacancy_parse({ rawText }),
      applicationId,
      requestId,
    };
    const added = this.queue.add(AI_JOBS.complete, job, { jobId: aiJobId });
    await withinLimit(added, OUTBOX_LIMITS.publishTimeoutMs);
    this.logger.log({ requestId, eventId: id, aiJobId }, 'capture parse queued');
  }
}
