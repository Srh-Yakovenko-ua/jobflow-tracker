import { silenceWindows } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { isUniqueViolation } from '../../prisma/unique-violation.js';
import { SettingsService } from '../settings/index.js';
import { RemindersService } from './reminders.service.js';
import { SilenceRepository, type SilentApplicationRow } from './silence.repository.js';

export type SilenceScanCounts = { started: number; alreadyStarted: number };

type SilenceOutcome = keyof SilenceScanCounts;

type SilenceStart = { row: SilentApplicationRow; now: Date };

const isNewSilence = ({ lastEventAt, reminders: [latest], stageEvents }: SilentApplicationRow) =>
  latest === undefined || latest.dueAt < (stageEvents[0]?.createdAt ?? lastEventAt);

@Injectable()
export class SilenceScanService {
  constructor(
    private readonly silence: SilenceRepository,
    private readonly reminders: RemindersService,
    private readonly settings: SettingsService,
  ) {}

  async startSilence(userId: string, now: Date): Promise<SilenceScanCounts> {
    const { silenceDays } = await this.settings.get(userId);
    const windows = silenceWindows({ levels: ['silent'], silenceDays, now });
    const rows = await this.silence.findSilentApplications(userId, { windows });
    const counts: SilenceScanCounts = { started: 0, alreadyStarted: 0 };
    for (const row of rows.filter(isNewSilence)) {
      counts[await this.start(userId, { row, now })] += 1;
    }
    return counts;
  }

  private async start(userId: string, { row, now }: SilenceStart): Promise<SilenceOutcome> {
    const { id: applicationId, company, lastEventAt } = row;
    try {
      await this.reminders.startFollowup(userId, { applicationId, company, lastEventAt, now });
      return 'started';
    } catch (error) {
      if (isUniqueViolation(error)) {
        return 'alreadyStarted';
      }
      throw error;
    }
  }
}
