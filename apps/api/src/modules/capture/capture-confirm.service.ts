import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { ApplicationDraftsService } from '../applications/index.js';
import { TimelineService } from '../events/index.js';
import { NotificationsService } from '../notifications/index.js';

@Injectable()
export class CaptureConfirmService {
  constructor(
    private readonly drafts: ApplicationDraftsService,
    private readonly timeline: TimelineService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  async confirm(userId: string, applicationId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const confirmedAt = await this.drafts.confirm(userId, { applicationId, tx });
      await this.timeline.record(userId, {
        applicationId,
        kind: 'draft_confirmed',
        payload: {},
        occurredAt: confirmedAt,
        tx,
      });
      await this.notifications.markVacancyParseRead(userId, {
        applicationId,
        now: confirmedAt,
        tx,
      });
    });
  }
}
