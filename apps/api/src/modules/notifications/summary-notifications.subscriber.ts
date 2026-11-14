import { monthlySummaryInputSchema } from '@jobflow/shared';
import { Injectable, type OnModuleInit } from '@nestjs/common';

import { AiJobRouter, type SettledAiJob } from '../ai/index.js';
import { NotificationsService } from './notifications.service.js';

const summaryPeriodSchema = monthlySummaryInputSchema.pick({ period: true });

@Injectable()
export class SummaryNotificationsSubscriber implements OnModuleInit {
  constructor(
    private readonly aiJobs: AiJobRouter,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.aiJobs.subscribe('monthly_summary', (settled) => this.notify(settled));
  }

  private async notify({ job, status }: SettledAiJob): Promise<void> {
    if (status !== 'done') {
      return;
    }
    const { month } = summaryPeriodSchema.parse(job.input).period;
    await this.notifications.recordOnce(job.userId, {
      type: 'monthly_summary_ready',
      payload: { aiJobId: job.aiJobId, month },
    });
  }
}
