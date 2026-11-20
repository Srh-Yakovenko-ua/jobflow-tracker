import { Injectable, type OnModuleInit } from '@nestjs/common';

import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import { AiJobRouter } from '../ai/index.js';
import { ResumeProfileService } from './resume-profile.service.js';
import { ResumeProfileQueueService } from './resume-profile-queue.service.js';
import { RESUME_EVENTS, resumeVersionUploadedPayloadSchema } from './resumes.events.js';

@Injectable()
export class ResumeProfileSubscriber implements OnModuleInit {
  constructor(
    private readonly events: DomainEventRouter,
    private readonly aiJobs: AiJobRouter,
    private readonly queue: ResumeProfileQueueService,
    private readonly profile: ResumeProfileService,
  ) {}

  onModuleInit(): void {
    this.events.subscribeParsed({
      type: RESUME_EVENTS.versionUploaded,
      schema: resumeVersionUploadedPayloadSchema,
      label: 'resume upload event',
      handle: (uploaded, delivery) => this.queue.enqueue(uploaded, delivery),
    });
    this.aiJobs.subscribe('resume_parse', (settled) => this.profile.settle(settled));
  }
}
