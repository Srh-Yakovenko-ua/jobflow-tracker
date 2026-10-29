import type { SettingsSuggestions, UpdateUserSettingsInput } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { withoutUndefined } from '../../common/without-undefined.js';
import type { UserSettingsRow } from '../../prisma/user-settings-row.js';
import { NEW_USER_SETTINGS, NEW_USER_SETTINGS_ROW } from '../../test/factories.js';
import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import { type ByUser, RecordedEvents } from '../../test/recorded-events.js';
import { BOHDAN_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { NOW } from '../../test/time.js';
import {
  type RecordSettingsEvent,
  type ResponseTimes,
  SettingsRepository,
  type UpdateSettings,
} from './settings.repository.js';
import { SettingsService } from './settings.service.js';

const UNAUTHORIZED = { body: { status: 401, type: 'unauthorized' } };

const CHANGE: UpdateUserSettingsInput = {
  silenceDays: 14,
  autoGhostDays: null,
  timezone: 'Europe/Warsaw',
  quietHoursStart: '23:30',
};

class FakeSettingsRepository extends RecordedEvents<RecordSettingsEvent> {
  readonly updates: ByUser<UpdateSettings>[] = [];
  responses: ResponseTimes = { answered: 0, medianDays: null };
  private stored: UserSettingsRow = NEW_USER_SETTINGS_ROW;

  find(userId: string): Promise<UserSettingsRow | null> {
    return Promise.resolve(userId === OLENA_ID ? this.stored : null);
  }

  update(userId: string, input: UpdateSettings): Promise<UserSettingsRow | null> {
    if (userId !== OLENA_ID) {
      return Promise.resolve(null);
    }
    this.updates.push({ userId, ...input });
    this.stored = { ...this.stored, ...withoutUndefined(input.data) };
    return Promise.resolve(this.stored);
  }

  responseTimes(userId: string): Promise<ResponseTimes> {
    return Promise.resolve(
      userId === OLENA_ID ? this.responses : { answered: 0, medianDays: null },
    );
  }
}

async function serviceWithFakes() {
  const repository = new FakeSettingsRepository();
  const moduleRef = await fakeTransactionModule({
    providers: [SettingsService, SettingsRepository],
    now: NOW,
  })
    .overrideProvider(SettingsRepository)
    .useValue(repository)
    .compile();
  return { repository, service: moduleRef.get(SettingsService) };
}

async function suggestionsFor(responses: ResponseTimes): Promise<SettingsSuggestions> {
  const { repository, service } = await serviceWithFakes();
  repository.responses = responses;
  return service.suggestions(OLENA_ID);
}

describe('SettingsService.get', () => {
  it('answers the stored settings with quiet hours as HH:MM', async () => {
    const { service } = await serviceWithFakes();

    expect(await service.get(OLENA_ID)).toEqual(NEW_USER_SETTINGS);
  });

  it('answers a user without a settings row with 401', async () => {
    const { service } = await serviceWithFakes();

    await expect(service.get(BOHDAN_ID)).rejects.toMatchObject(UNAUTHORIZED);
  });
});

describe('SettingsService.update', () => {
  it('writes only the sent fields, quiet hours as a time of day, and records settings.changed in the same transaction', async () => {
    const { repository, service } = await serviceWithFakes();

    const settings = await service.update(OLENA_ID, CHANGE);

    expect(repository.updates).toStrictEqual([
      {
        userId: OLENA_ID,
        data: {
          silenceDays: 14,
          autoGhostDays: null,
          timezone: 'Europe/Warsaw',
          quietHoursStart: new Date('1970-01-01T23:30:00.000Z'),
        },
        tx: FAKE_TRANSACTION,
      },
    ]);
    expect(repository.events).toEqual([
      {
        userId: OLENA_ID,
        event: {
          eventType: 'settings.changed',
          fields: ['silenceDays', 'autoGhostDays', 'timezone', 'quietHoursStart'],
        },
        tx: FAKE_TRANSACTION,
      },
    ]);
    expect(settings).toEqual({ ...NEW_USER_SETTINGS, ...CHANGE });
  });

  it('answers a user without a settings row with 401 and records no event', async () => {
    const { repository, service } = await serviceWithFakes();

    await expect(service.update(BOHDAN_ID, CHANGE)).rejects.toMatchObject(UNAUTHORIZED);
    expect(repository.events).toEqual([]);
  });
});

describe('SettingsService.suggestions', () => {
  it('falls back to 7 days with no median when fewer than 5 applications were answered', async () => {
    expect(await suggestionsFor({ answered: 4, medianDays: 2 })).toEqual({
      silenceDays: 7,
      medianResponseDays: null,
      answeredApplications: 4,
    });
  });

  it.each([
    { case: 'one day over the whole median', medianDays: 6.4, silenceDays: 7, median: 6 },
    { case: 'the 3 day minimum for a fast median', medianDays: 0.2, silenceDays: 3, median: 0 },
    { case: 'the 30 day maximum for a slow median', medianDays: 45, silenceDays: 30, median: 45 },
  ])('suggests $case from 5 answered applications', async ({ medianDays, silenceDays, median }) => {
    expect(await suggestionsFor({ answered: 5, medianDays })).toEqual({
      silenceDays,
      medianResponseDays: median,
      answeredApplications: 5,
    });
  });
});
