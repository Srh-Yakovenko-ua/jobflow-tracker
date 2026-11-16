import { describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { appTestingModule, useTestApp } from '../../test/app.js';
import { type SignedInSearcher, signedInWithSearch } from '../../test/applications.js';
import { compensationOf, createApplicationRows, createStageEvents } from '../../test/factories.js';
import { errorPathsOf } from '../../test/http.js';
import { outboxRows } from '../../test/outbox.js';
import { rhythmOf, rhythmResponseOf } from '../../test/rhythm.js';
import { MISSING_ID } from '../../test/service-fixtures.js';
import { fixedClock } from '../../test/time.js';
import { RhythmRequestsService } from './index.js';

const WEDNESDAY_IN_KYIV = new Date('2026-11-11T10:00:00.000Z');

const QUIET = { applications: 0, followups: 0, interviews: 0, offers: 0 };

const quietWeek = (weekStart: string) => ({ weekStart, ...QUIET, status: 'next_week' });

const SEEDED_WEEKS = [
  quietWeek('2026-09-21'),
  quietWeek('2026-09-28'),
  quietWeek('2026-10-05'),
  quietWeek('2026-10-12'),
  quietWeek('2026-10-19'),
  { ...quietWeek('2026-10-26'), applications: 1 },
  { weekStart: '2026-11-02', ...QUIET, applications: 2, followups: 1, status: 'in_rhythm' },
  { weekStart: '2026-11-09', ...QUIET, interviews: 1, status: 'in_rhythm' },
];

type CreatedAt = { occurredAt: string; row?: { isDraft?: boolean; deletedAt?: Date } };

describe('GET /rhythm', () => {
  const testApp = useTestApp(() =>
    appTestingModule().overrideProvider(Clock).useValue(fixedClock(WEDNESDAY_IN_KYIV)),
  );

  async function createdAt(
    { userId, searchId }: SignedInSearcher,
    { occurredAt, row = {} }: CreatedAt,
  ) {
    const [applicationId = ''] = await createApplicationRows(testApp.prisma, {
      userId,
      searchId,
      rows: [{ lastEventAt: new Date(occurredAt), ...row }],
    });
    await createStageEvents(testApp.prisma, [
      { applicationId, fromStage: null, toStage: 'applied', occurredAt: new Date(occurredAt) },
    ]);
    return applicationId;
  }

  const movedAt = (
    applicationId: string,
    moves: Omit<Prisma.StageEventCreateManyInput, 'applicationId'>[],
  ) =>
    createStageEvents(
      testApp.prisma,
      moves.map((move) => ({ applicationId, ...move })),
    );

  const timelineAt = (
    applicationId: string,
    kinds: Record<string, 'followup_sent' | 'note_added'>,
  ) =>
    testApp.prisma.timelineEvent.createMany({
      data: Object.entries(kinds).map(([occurredAt, kind]) => ({
        applicationId,
        kind,
        occurredAt: new Date(occurredAt),
      })),
    });

  async function seedSearch(searcher: SignedInSearcher) {
    const sundayLate = await createdAt(searcher, { occurredAt: '2026-11-01T21:30:00.000Z' });
    const mondayEarly = await createdAt(searcher, { occurredAt: '2026-11-01T22:10:00.000Z' });
    const tuesday = await createdAt(searcher, { occurredAt: '2026-11-03T09:00:00.000Z' });
    await createdAt(searcher, { occurredAt: '2026-09-20T09:00:00.000Z' });
    await createdAt(searcher, { occurredAt: '2026-11-03T09:00:00.000Z', row: { isDraft: true } });
    await createdAt(searcher, {
      occurredAt: '2026-11-03T09:00:00.000Z',
      row: { deletedAt: WEDNESDAY_IN_KYIV },
    });
    await movedAt(mondayEarly, [
      {
        fromStage: 'applied',
        toStage: 'tech_interview',
        occurredAt: new Date('2026-11-10T09:00:00.000Z'),
      },
    ]);
    const [undone] = await testApp.prisma.stageEvent.createManyAndReturn({
      data: [
        {
          applicationId: tuesday,
          fromStage: 'applied',
          toStage: 'offer',
          occurredAt: new Date('2026-11-10T10:00:00.000Z'),
        },
      ],
      select: { id: true },
    });
    await createStageEvents(testApp.prisma, [
      compensationOf({ applicationId: tuesday, compensatesEventId: undone?.id ?? '' }),
    ]);
    await timelineAt(sundayLate, {
      '2026-11-04T09:00:00.000Z': 'followup_sent',
      '2026-11-05T09:00:00.000Z': 'note_added',
    });
  }

  const setGoal = ({ userId }: SignedInSearcher, weeklyGoalApplications: number) =>
    testApp.prisma.userSettings.update({ where: { userId }, data: { weeklyGoalApplications } });

  it("answers 8 local weeks oldest first with the user's own counts, the streak and the best week", async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);
    await seedSearch(olena);
    await seedSearch(bohdan);
    await createdAt(bohdan, { occurredAt: '2026-11-10T09:00:00.000Z' });
    await setGoal(olena, 2);

    expect(await rhythmOf(testApp.app, olena)).toEqual({
      goal: { applications: 2, followups: null },
      suggestedGoal: null,
      pausedFrom: null,
      pausedUntil: null,
      weeks: SEEDED_WEEKS,
      streak: 2,
      bestWeek: { weekStart: '2026-11-02', applications: 2 },
    });
    expect((await rhythmOf(testApp.app, bohdan)).weeks.at(-1)).toMatchObject({
      applications: 1,
      interviews: 1,
      status: 'no_goal',
    });
  });

  it('answers only the asked number of weeks', async () => {
    const olena = await signedInWithSearch(testApp.prisma);

    const rhythm = await rhythmOf(testApp.app, { ...olena, query: '?weeks=2' });

    expect(rhythm.weeks.map(({ weekStart }) => weekStart)).toEqual(['2026-11-02', '2026-11-09']);
  });

  it.each(['0', '27', 'many'])('answers weeks=%s with 422 at weeks', async (weeks) => {
    const olena = await signedInWithSearch(testApp.prisma);

    const response = await rhythmResponseOf(testApp.app, { ...olena, query: `?weeks=${weeks}` });

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, ['weeks']]);
  });

  it('answers without a token with 401', async () => {
    const response = await rhythmResponseOf(testApp.app, {});

    expect(response.status).toBe(401);
  });

  it('requests the close of the past local week as one rhythm.week_closed row per user and skips an unknown user', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const requests = testApp.app.get(RhythmRequestsService);

    await expect(requests.requestWeekClose([olena.userId, MISSING_ID])).resolves.toEqual({
      picked: 2,
      requested: 1,
    });

    expect(await outboxRows(testApp.prisma, { eventType: 'rhythm.week_closed' })).toEqual([
      {
        aggregate: 'user',
        aggregateId: olena.userId,
        eventType: 'rhythm.week_closed',
        payload: { userId: olena.userId, weekStart: '2026-11-02' },
      },
    ]);
  });
});
