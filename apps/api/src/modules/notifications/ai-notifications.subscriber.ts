import { NOTIFIED_AI_KINDS, type NotifiedAiKind } from '@jobflow/shared';
import { Injectable, type OnModuleInit } from '@nestjs/common';

import { AiJobRouter, type SettledAiJob } from '../ai/index.js';
import { NotificationsService, type OnceNotification } from './notifications.service.js';

type NotifiedJob = { kind: NotifiedAiKind; settled: SettledAiJob };

function notificationOf({ kind, settled }: NotifiedJob): OnceNotification {
  const { aiJobId, applicationId, resumeVersionId } = settled.job;
  const payload = {
    aiJobId,
    kind,
    ...(applicationId !== undefined && { applicationId }),
    ...(resumeVersionId !== undefined && { resumeVersionId }),
  };
  return settled.status === 'done'
    ? { type: 'ai_done', payload }
    : { type: 'ai_failed', payload: { ...payload, errorType: settled.errorType } };
}

@Injectable()
export class AiNotificationsSubscriber implements OnModuleInit {
  constructor(
    private readonly aiJobs: AiJobRouter,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    for (const kind of NOTIFIED_AI_KINDS) {
      this.aiJobs.subscribe(kind, (settled) =>
        this.notifications.recordOnce(settled.job.userId, notificationOf({ kind, settled })),
      );
    }
  }
}
