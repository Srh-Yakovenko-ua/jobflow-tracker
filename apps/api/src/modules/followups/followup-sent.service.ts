import { Injectable } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TimelineService } from '../events/index.js';
import { RemindersService } from '../reminders/index.js';

@Injectable()
export class FollowupSentService {
  constructor(
    private readonly timeline: TimelineService,
    private readonly reminders: RemindersService,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async markSent(userId: string, applicationId: string): Promise<void> {
    const occurredAt = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await this.timeline.record(userId, {
        applicationId,
        kind: 'followup_sent',
        payload: {},
        occurredAt,
        tx,
      });
      await this.reminders.resolveFollowups(userId, { applicationId, tx });
    });
  }
}
