import type { UserSettings } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { unauthorized } from '../../common/app-error.js';
import { toUserSettings, type UserSettingsRow } from '../../prisma/user-settings-row.js';
import { NEW_USER_SETTINGS_ROW } from '../../test/factories.js';
import { fakeTransactionModule } from '../../test/fake-prisma.js';
import { BOHDAN_ID, OLENA_ID } from '../../test/service-fixtures.js';
import {
  type OccurrencesSinceQuery,
  type TimelineOccurrence,
  TimelineService,
} from '../events/index.js';
import { SettingsService } from '../settings/index.js';
import { type RhythmEventRow, RhythmRepository } from './rhythm.repository.js';
import { RhythmService } from './rhythm.service.js';

const WEDNESDAY_IN_KYIV = new Date('2026-11-11T10:00:00.000Z');

const FOLLOWED_UP_ID = '0190a000-0000-7000-8000-00000000f001';

const dateColumn = (date: string) => new Date(`${date}T00:00:00.000Z`);

const GOAL_OF_TWO: Partial<UserSettingsRow> = { weeklyGoalApplications: 2 };

const at = (kind: RhythmEventRow['kind'], instant: string): RhythmEventRow => ({
  kind,
  occurredAt: new Date(instant),
});

const THREE_WEEKS: RhythmEventRow[] = [
  at('applications', '2026-11-01T21:30:00.000Z'),
  at('applications', '2026-11-01T22:10:00.000Z'),
  at('applications', '2026-11-03T09:00:00.000Z'),
  at('followups', '2026-11-04T09:00:00.000Z'),
  at('interviews', '2026-11-10T09:00:00.000Z'),
];

class FakeRhythmRepository {
  readonly since: Date[] = [];

  constructor(
    private readonly settings: Partial<UserSettingsRow>,
    private readonly rows: RhythmEventRow[],
  ) {}

  get(userId: string): Promise<UserSettings> {
    if (userId !== OLENA_ID) return Promise.reject(unauthorized());
    return Promise.resolve(toUserSettings({ ...NEW_USER_SETTINGS_ROW, ...this.settings }));
  }

  stageEventsSince(_userId: string, since: Date): Promise<RhythmEventRow[]> {
    this.since.push(since);
    return Promise.resolve(this.rows.filter(({ kind }) => kind !== 'followups'));
  }

  occurrencesSince(
    _userId: string,
    { kind, since }: OccurrencesSinceQuery,
  ): Promise<TimelineOccurrence[]> {
    this.since.push(since);
    const followups =
      kind === 'followup_sent' ? this.rows.filter((row) => row.kind === 'followups') : [];
    return Promise.resolve(
      followups.map(({ occurredAt }) => ({ applicationId: FOLLOWED_UP_ID, occurredAt })),
    );
  }
}

async function rhythmOf(settings: Partial<UserSettingsRow>, rows: RhythmEventRow[] = []) {
  const repository = new FakeRhythmRepository(settings, rows);
  const moduleRef = await fakeTransactionModule({
    providers: [
      RhythmService,
      { provide: RhythmRepository, useValue: repository },
      { provide: TimelineService, useValue: repository },
      { provide: SettingsService, useValue: repository },
    ],
    now: WEDNESDAY_IN_KYIV,
  }).compile();
  return { repository, service: moduleRef.get(RhythmService) };
}

describe('RhythmService.get', () => {
  it('puts each count in its local week, oldest first, from the Kyiv Monday of the oldest week', async () => {
    const { repository, service } = await rhythmOf(GOAL_OF_TWO, THREE_WEEKS);

    const rhythm = await service.get(OLENA_ID, { weeks: 3 });

    expect(repository.since).toEqual([
      new Date('2026-10-25T22:00:00.000Z'),
      new Date('2026-10-25T22:00:00.000Z'),
    ]);
    expect(rhythm).toEqual({
      goal: { applications: 2, followups: null },
      suggestedGoal: null,
      pausedFrom: null,
      pausedUntil: null,
      weeks: [
        {
          weekStart: '2026-10-26',
          applications: 1,
          followups: 0,
          interviews: 0,
          offers: 0,
          status: 'next_week',
        },
        {
          weekStart: '2026-11-02',
          applications: 2,
          followups: 1,
          interviews: 0,
          offers: 0,
          status: 'in_rhythm',
        },
        {
          weekStart: '2026-11-09',
          applications: 0,
          followups: 0,
          interviews: 1,
          offers: 0,
          status: 'in_rhythm',
        },
      ],
      streak: 2,
      bestWeek: { weekStart: '2026-11-02', applications: 2 },
    });
  });

  it('reads a week inside the pause as paused and keeps the streak across it', async () => {
    const pause = { pausedFrom: dateColumn('2026-11-03'), pausedUntil: dateColumn('2026-11-05') };
    const { service } = await rhythmOf({ ...GOAL_OF_TWO, ...pause }, [
      at('applications', '2026-10-27T09:00:00.000Z'),
      at('applications', '2026-10-28T09:00:00.000Z'),
    ]);

    const rhythm = await service.get(OLENA_ID, { weeks: 3 });

    expect(rhythm.weeks.map(({ status }) => status)).toEqual([
      'in_rhythm',
      'paused',
      'in_progress',
    ]);
    expect([rhythm.streak, rhythm.pausedFrom, rhythm.pausedUntil]).toEqual([
      1,
      '2026-11-03',
      '2026-11-05',
    ]);
  });

  it('takes the newest of two weeks with the most applications as the best week', async () => {
    const { service } = await rhythmOf({}, [
      at('applications', '2026-10-27T09:00:00.000Z'),
      at('applications', '2026-11-03T09:00:00.000Z'),
    ]);

    const rhythm = await service.get(OLENA_ID, { weeks: 3 });

    expect(rhythm.bestWeek).toEqual({ weekStart: '2026-11-02', applications: 1 });
    expect(rhythm.weeks.map(({ status }) => status)).toEqual(['no_goal', 'no_goal', 'no_goal']);
  });

  it('answers no best week when no application was sent in the window', async () => {
    const { service } = await rhythmOf(GOAL_OF_TWO, [at('followups', '2026-11-03T09:00:00.000Z')]);

    expect((await service.get(OLENA_ID, { weeks: 2 })).bestWeek).toBeNull();
  });

  it('answers a user without a settings row with 401', async () => {
    const { service } = await rhythmOf({});

    await expect(service.get(BOHDAN_ID, { weeks: 8 })).rejects.toMatchObject({
      body: { status: 401, type: 'unauthorized' },
    });
  });
});
