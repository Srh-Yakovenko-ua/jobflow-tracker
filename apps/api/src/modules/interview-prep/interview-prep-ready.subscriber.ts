import { Injectable, type OnModuleInit } from '@nestjs/common';

import { AiJobRouter, type SettledAiJob } from '../ai/index.js';
import { NotificationsService } from '../notifications/index.js';
import { InterviewPrepSources } from './interview-prep-sources.service.js';

@Injectable()
export class InterviewPrepReadySubscriber implements OnModuleInit {
  constructor(
    private readonly aiJobs: AiJobRouter,
    private readonly sources: InterviewPrepSources,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.aiJobs.subscribe('interview_prep', (settled) => this.notify(settled));
  }

  private async notify({ job, status }: SettledAiJob): Promise<void> {
    const { userId, aiJobId, applicationId } = job;
    if (status !== 'done' || applicationId === undefined) {
      return;
    }
    const interview = await this.sources.interviewWithinLead(userId, applicationId);
    if (interview === null) {
      return;
    }
    const { company, kind, startsAt } = interview;
    await this.notifications.recordOnce(userId, {
      type: 'interview_prep_ready',
      payload: {
        aiJobId,
        applicationId,
        company,
        eventKind: kind,
        startsAt: startsAt.toISOString(),
      },
    });
  }
}
