import {
  DEFAULT_SILENCE_DAYS,
  localDateOf,
  type SettingsSuggestions,
  type UpdateUserSettingsInput,
  USER_SETTINGS_LIMITS,
  type UserSettings,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { unauthorized, validation } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  calendarDateOf,
  dateColumnOf,
  toUserSettings,
  type UserSettingsRow,
} from '../../prisma/user-settings-row.js';
import { SETTINGS_EVENTS, settingsFieldSchema } from './settings.events.js';
import { type SettingsChanges, SettingsRepository } from './settings.repository.js';

export const SILENCE_SUGGESTION = { minAnsweredApplications: 5 } as const;

const { silenceDays } = USER_SETTINGS_LIMITS;

type PauseContext = { current: UserSettingsRow; today: string };

const clockDate = (time: string) => new Date(`1970-01-01T${time}:00.000Z`);

function pauseChanges(
  pausedUntil: string | null | undefined,
  { current, today }: PauseContext,
): SettingsChanges {
  if (pausedUntil === undefined) return {};
  if (pausedUntil === null) return { pausedUntil: null, pausedFrom: null };
  if (pausedUntil < today) {
    throw validation([{ path: 'pausedUntil', message: 'pausedUntil is before the local today' }]);
  }
  const runningUntil = calendarDateOf(current.pausedUntil);
  const starts = runningUntil === null || runningUntil < today;
  return {
    pausedUntil: dateColumnOf(pausedUntil),
    ...(starts && { pausedFrom: dateColumnOf(today) }),
  };
}

function settingsChanges(
  { quietHoursStart, quietHoursEnd, pausedUntil, ...changes }: UpdateUserSettingsInput,
  pause: PauseContext,
): SettingsChanges {
  return {
    ...changes,
    ...(quietHoursStart !== undefined && { quietHoursStart: clockDate(quietHoursStart) }),
    ...(quietHoursEnd !== undefined && { quietHoursEnd: clockDate(quietHoursEnd) }),
    ...pauseChanges(pausedUntil, pause),
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
    private readonly clock: Clock,
  ) {}

  async get(userId: string): Promise<UserSettings> {
    return toUserSettings(signedInSettings(await this.repository.find(userId)));
  }

  async update(userId: string, input: UpdateUserSettingsInput): Promise<UserSettings> {
    const now = this.clock.now();
    const fields = settingsFieldSchema.options.filter((field) => field in input);
    const row = await this.prisma.$transaction(async (tx) => {
      const current = signedInSettings(await this.repository.find(userId, { tx }));
      const today = localDateOf({ timezone: input.timezone ?? current.timezone }, now);
      const data = settingsChanges(input, { current, today });
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
