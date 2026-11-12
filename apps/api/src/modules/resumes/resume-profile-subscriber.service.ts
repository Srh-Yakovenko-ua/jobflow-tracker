import { Injectable, type OnModuleInit } from '@nestjs/common';

import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import { AiJobRouter } from '../ai/index.js';
import { ResumeProfileService } from './resume-profile.service.js';
import { ResumeProfileQueueService } from './resume-profile-queue.service.js';
import { RESUME_EVENTS } from './resumes.events.js';

@Injectable()
export class ResumeProfileSubscriber implements OnModuleInit {
  constructor(
    private readonly events: DomainEventRouter,
    private readonly aiJobs: AiJobRouter,
    private readonly queue: ResumeProfileQueueService,
    private readonly profile: ResumeProfileService,
  ) {}

  onModuleInit(): void {
    this.events.subscribe(RESUME_EVENTS.versionUploaded, (event) => this.queue.enqueue(event));
    this.aiJobs.subscribe('resume_parse', (settled) => this.profile.settle(settled));
  }
}
