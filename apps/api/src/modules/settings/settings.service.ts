import {
  DEFAULT_SILENCE_DAYS,
  type SettingsSuggestions,
  type UpdateUserSettingsInput,
  USER_SETTINGS_LIMITS,
  type UserSettings,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { unauthorized } from '../../common/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toUserSettings, type UserSettingsRow } from '../../prisma/user-settings-row.js';
import { SETTINGS_EVENTS, settingsFieldSchema } from './settings.events.js';
import { type SettingsChanges, SettingsRepository } from './settings.repository.js';

export const SILENCE_SUGGESTION = { minAnsweredApplications: 5 } as const;

const { silenceDays } = USER_SETTINGS_LIMITS;

const clockDate = (time: string) => new Date(`1970-01-01T${time}:00.000Z`);

function settingsChanges({
  quietHoursStart,
  quietHoursEnd,
  ...changes
}: UpdateUserSettingsInput): SettingsChanges {
  return {
    ...changes,
    ...(quietHoursStart !== undefined && { quietHoursStart: clockDate(quietHoursStart) }),
    ...(quietHoursEnd !== undefined && { quietHoursEnd: clockDate(quietHoursEnd) }),
  };
}

function signedInSettings(row: UserSettingsRow | null): UserSettingsRow {
  if (row === null) {
    throw unauthorized();
  }
  return row;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly repository: SettingsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async get(userId: string): Promise<UserSettings> {
    return toUserSettings(signedInSettings(await this.repository.find(userId)));
  }

  async update(userId: string, input: UpdateUserSettingsInput): Promise<UserSettings> {
    const data = settingsChanges(input);
    const fields = settingsFieldSchema.options.filter((field) => field in input);
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = signedInSettings(await this.repository.update(userId, { data, tx }));
      const event = { eventType: SETTINGS_EVENTS.changed, fields };
      await this.repository.recordEvent(userId, { event, tx });
      return updated;
    });
    return toUserSettings(row);
  }

  async suggestions(userId: string): Promise<SettingsSuggestions> {
    const { answered, medianDays } = await this.repository.responseTimes(userId);
    if (answered < SILENCE_SUGGESTION.minAnsweredApplications || medianDays === null) {
      return {
        silenceDays: DEFAULT_SILENCE_DAYS,
        medianResponseDays: null,
        answeredApplications: answered,
      };
    }
    const medianResponseDays = Math.floor(medianDays);
    return {
      silenceDays: Math.min(Math.max(medianResponseDays + 1, silenceDays.min), silenceDays.max),
      medianResponseDays,
      answeredApplications: answered,
    };
  }
}
