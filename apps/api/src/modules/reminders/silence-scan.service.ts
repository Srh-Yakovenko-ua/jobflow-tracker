import { type SilenceItem, silenceWindows, wholeDaysBetween } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { isUniqueViolation } from '../../prisma/unique-violation.js';
import { NotificationsService } from '../notifications/index.js';
import { SettingsService } from '../settings/index.js';
import { RemindersService } from './reminders.service.js';
import { SilenceRepository, type SilentApplicationRow } from './silence.repository.js';
import { silenceMarkOf } from './silence-mark.js';

export type SilenceScanCounts = { started: number; alreadyStarted: number };

type SilenceOutcome = keyof SilenceScanCounts;

type SilenceStart = { item: SilenceItem; row: SilentApplicationRow; now: Date };

const isNewSilence = ({ lastEventAt, reminders: [latest], stageEvents }: SilentApplicationRow) =>
  latest === undefined || latest.dueAt < (stageEvents[0]?.createdAt ?? lastEventAt);

const silenceItemOf = (
  { id, company, lastEventAt }: SilentApplicationRow,
  now: Date,
): SilenceItem => ({
  applicationId: id,
  company,
  days: wholeDaysBetween(lastEventAt, now),
});

@Injectable()
export class SilenceScanService {
  constructor(
    private readonly silence: SilenceRepository,
    private readonly reminders: RemindersService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  async startSilence(userId: string, now: Date): Promise<SilenceScanCounts> {
    const { silenceDays } = await this.settings.get(userId);
    const windows = silenceWindows({ levels: ['silent'], silenceDays, now });
    const rows = await this.silence.findSilentApplications(userId, { windows });
    const counts: SilenceScanCounts = { started: 0, alreadyStarted: 0 };
    const items: SilenceItem[] = [];
    try {
      for (const row of rows.filter(isNewSilence)) {
        const item = silenceItemOf(row, now);
        const outcome = await this.start(userId, { item, row, now });
        counts[outcome] += 1;
        if (outcome === 'started') items.push(item);
      }
    } finally {
      await this.notifyStarted(userId, items);
    }
    return counts;
  }

  private async notifyStarted(userId: string, items: SilenceItem[]): Promise<void> {
    if (items.length > 0) {
      await this.notifications.record(userId, { type: 'silence', payload: { items } });
    }
  }

  private async start(userId: string, { item, row, now }: SilenceStart): Promise<SilenceOutcome> {
    const { applicationId, days } = item;
    const seen = silenceMarkOf(row);
    try {
      const started = await this.reminders.startFollowup(userId, {
        applicationId,
        days,
        now,
        seen,
      });
      return started ? 'started' : 'alreadyStarted';
    } catch (error) {
      if (isUniqueViolation(error)) {
        return 'alreadyStarted';
      }
      throw error;
    }
  }
}
