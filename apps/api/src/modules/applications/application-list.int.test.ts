import { randomUUID } from 'node:crypto';

import {
  type ApplicationBoardResponse,
  applicationBoardResponseSchema,
  type ApplicationCard,
  type ApplicationListResponse,
  applicationResponseSchema,
  errorResponseSchema,
  type Stage,
  STAGES,
} from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { appTestingModule, useTestApp } from '../../test/app.js';
import {
  applicationPath,
  APPLICATIONS_BOARD_PATH,
  APPLICATIONS_PATH,
  getApplicationBoard,
  getWithQuery,
  listApplications,
  type QueryString,
  signedInWithSearch,
} from '../../test/applications.js';
import {
  type ApplicationRowInput,
  createAiJob,
  createApplicationRows,
  createScheduledEvent,
  createSearch,
  createStageEvents,
} from '../../test/factories.js';
import { callRoute } from '../../test/http.js';
import { daysBefore, minutesAfter, minutesBefore, NOW } from '../../test/time.js';

type Owner = { userId: string; searchId: string };

type BoardColumnView = { count: number; companies: string[] | null };

const clock: Clock = { now: () => NOW };

const OLENA_STAGE_COUNTS = {
  applied: 3,
  screening: 2,
  tech_interview: 1,
  final: 1,
  offer: 1,
  rejected: 4,
  ghosted: 2,
  withdrawn: 1,
} satisfies Record<Stage, number>;

const EVERY_OUTCOME = { expand: 'rejected,ghosted,withdrawn' };

const FILTER_ROWS = [
  {
    company: 'Kavun Labs',
    position: 'Backend engineer',
    source: 'djinni',
    currentStage: 'applied',
    matchScore: 80,
    lastEventAt: daysBefore(8),
  },
  {
    company: 'Smereka Soft',
    position: 'Platform engineer at KAVUN',
    source: 'dou',
    currentStage: 'applied',
    matchScore: null,
    lastEventAt: daysBefore(4),
  },
  {
    company: 'Yasen Tech',
    position: 'Frontend engineer',
    source: 'linkedin',
    currentStage: 'applied',
    matchScore: 55,
    lastEventAt: daysBefore(3),
  },
  {
    company: 'Dub Data',
    position: 'Data engineer',
    source: 'dou',
    currentStage: 'final',
    matchScore: null,
    lastEventAt: daysBefore(13),
  },
  {
    company: 'Buk Cloud',
    position: 'Site reliability engineer',
    source: 'djinni',
    currentStage: 'final',
    matchScore: 91,
    lastEventAt: daysBefore(14),
  },
  {
    company: 'Lypa Pay',
    position: 'Backend engineer',
    source: 'referral',
    currentStage: 'offer',
    matchScore: 70,
    lastEventAt: daysBefore(30),
  },
  {
    company: 'Klen Games',
    position: 'Game server engineer',
    source: 'dou',
    currentStage: 'rejected',
    matchScore: null,
    lastEventAt: daysBefore(31),
  },
] satisfies ApplicationRowInput[];

const TIED_AT = daysBefore(1);

const PAGE_ROWS = [
  { company: 'Newest', lastEventAt: minutesBefore(5) },
  { company: 'Tied 1', lastEventAt: TIED_AT },
  { company: 'Tied 2', lastEventAt: TIED_AT },
  { company: 'Tied 3', lastEventAt: TIED_AT },
  { company: 'Tied 4', lastEventAt: TIED_AT },
  { company: 'Oldest', lastEventAt: daysBefore(2) },
] satisfies ApplicationRowInput[];

const LIKE_PATTERN_ROWS = [
  { company: 'Смерека Софт 10', lastEventAt: daysBefore(1) },
  { company: 'Софт_1', lastEventAt: daysBefore(2) },
  { company: 'Знижка 100%', lastEventAt: daysBefore(3) },
  { company: 'Back\\slash', lastEventAt: daysBefore(4) },
].map((row) => ({ ...row, position: 'Backend engineer' })) satisfies ApplicationRowInput[];

const EMPTY_BOARD: Record<Stage, BoardColumnView> = {
  applied: { count: 0, companies: [] },
  screening: { count: 0, companies: [] },
  tech_interview: { count: 0, companies: [] },
  final: { count: 0, companies: [] },
  offer: { count: 0, companies: [] },
  rejected: { count: 0, companies: null },
  ghosted: { count: 0, companies: null },
  withdrawn: { count: 0, companies: null },
};

function rowsByStage(counts: Partial<Record<Stage, number>>): ApplicationRowInput[] {
  return STAGES.flatMap((stage) => Array.from({ length: counts[stage] ?? 0 }, () => stage)).map(
    (currentStage, index) => ({ currentStage, lastEventAt: minutesBefore(index + 1) }),
  );
}

const countsOf = ({ columns }: ApplicationBoardResponse) =>
  Object.fromEntries(Object.entries(columns).map(([stage, { count }]) => [stage, count]));

const itemCountsOf = ({ columns }: ApplicationBoardResponse) =>
  Object.fromEntries(
    Object.entries(columns).map(([stage, { items }]) => [stage, items?.length ?? null]),
  );

const columnViewsOf = ({ columns }: ApplicationBoardResponse) =>
  Object.fromEntries(
    Object.entries(columns).map(([stage, { count, items }]) => [
      stage,
      { count, companies: items?.map(({ company }) => company) ?? null },
    ]),
  );

const boardCards = ({ columns }: ApplicationBoardResponse): ApplicationCard[] =>
  Object.values(columns).flatMap(({ items }) => items ?? []);

const sortedIds = (cards: ApplicationCard[]) => cards.map(({ id }) => id).sort();

const companiesOf = ({ items }: ApplicationListResponse) => items.map(({ company }) => company);

const errorPaths = (body: unknown) =>
  (errorResponseSchema.parse(body).errors ?? []).map(({ path }) => path);

describe('the application list and board routes', () => {
  const testApp = useTestApp(() => appTestingModule().overrideProvider(Clock).useValue(clock));

  const rowsFor = (owner: Owner, rows: ApplicationRowInput[]) =>
    createApplicationRows(testApp.prisma, { ...owner, rows });

  async function olenaWithNoise() {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);
    const archivedSearchId = await createSearch(testApp.prisma, {
      userId: olena.userId,
      status: 'archived',
    });
    const [draft, ...others] = rowsByStage(OLENA_STAGE_COUNTS);
    const activeIds = await rowsFor(olena, [
      ...(draft ? [{ ...draft, isDraft: true }] : []),
      ...others,
    ]);
    await rowsFor(olena, [{ currentStage: 'screening', lastEventAt: NOW, deletedAt: NOW }]);
    const archivedIds = await rowsFor(
      { userId: olena.userId, searchId: archivedSearchId },
      rowsByStage({ applied: 2, rejected: 1 }),
    );
    const bohdanIds = await rowsFor(bohdan, rowsByStage({ applied: 1, screening: 1, rejected: 2 }));
    return { olena, bohdan, archivedSearchId, activeIds, archivedIds, bohdanIds };
  }

  async function walkPages({ accessToken, sort }: { accessToken: string; sort: string }) {
    const pages: string[][] = [];
    let cursor: string | null = null;
    do {
      const query: QueryString = { limit: '2', sort, ...(cursor === null ? {} : { cursor }) };
      const page = await listApplications(testApp.app, { accessToken, query });
      pages.push(companiesOf(page));
      cursor = page.nextCursor;
    } while (cursor !== null && pages.length < 10);
    return pages;
  }

  it("counts every stage of the active search exactly, keeps outcomes as counts only and leaves out deleted, archived and BOHDAN's applications", async () => {
    const { olena } = await olenaWithNoise();

    const board = await getApplicationBoard(testApp.app, { accessToken: olena.accessToken });

    expect(countsOf(board)).toEqual(OLENA_STAGE_COUNTS);
    expect(itemCountsOf(board)).toEqual({
      applied: 3,
      screening: 2,
      tech_interview: 1,
      final: 1,
      offer: 1,
      rejected: null,
      ghosted: null,
      withdrawn: null,
    });
    expect(board.columns.applied.items?.map(({ isDraft }) => isDraft)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('expands rejected and ghosted into as many cards as their counts while withdrawn stays a count', async () => {
    const { olena } = await olenaWithNoise();

    const board = await getApplicationBoard(testApp.app, {
      accessToken: olena.accessToken,
      query: { expand: 'rejected,ghosted' },
    });

    expect(board.columns.rejected).toMatchObject({ count: 4 });
    expect(board.columns.ghosted).toMatchObject({ count: 2 });
    expect(itemCountsOf(board)).toMatchObject({ rejected: 4, ghosted: 2, withdrawn: null });
  });

  it('keeps the archived search off the board and out of the default list, and lists it only by its searchId', async () => {
    const { olena, archivedSearchId, activeIds, archivedIds } = await olenaWithNoise();
    const { accessToken } = olena;

    const board = await getApplicationBoard(testApp.app, { accessToken, query: EVERY_OUTCOME });
    const list = await listApplications(testApp.app, { accessToken, query: { limit: '100' } });
    const archived = await listApplications(testApp.app, {
      accessToken,
      query: { searchId: archivedSearchId },
    });

    expect(sortedIds(boardCards(board))).toEqual([...activeIds].sort());
    expect(sortedIds(list.items)).toEqual([...activeIds].sort());
    expect(sortedIds(archived.items)).toEqual([...archivedIds].sort());
  });

  it("shows BOHDAN only his own applications on the list and the board while OLENA's exist", async () => {
    const { bohdan, bohdanIds } = await olenaWithNoise();
    const { accessToken } = bohdan;

    const board = await getApplicationBoard(testApp.app, { accessToken, query: EVERY_OUTCOME });
    const list = await listApplications(testApp.app, { accessToken });

    expect(countsOf(board)).toEqual({
      applied: 1,
      screening: 1,
      tech_interview: 0,
      final: 0,
      offer: 0,
      rejected: 2,
      ghosted: 0,
      withdrawn: 0,
    });
    expect(sortedIds(boardCards(board))).toEqual([...bohdanIds].sort());
    expect(sortedIds(list.items)).toEqual([...bohdanIds].sort());
  });

  it.each([
    { case: "OLENA's active search", searchOf: (olena: Owner) => olena.searchId },
    { case: "OLENA's archived search", searchOf: (_: Owner, archived: string) => archived },
    { case: 'a random uuid', searchOf: () => randomUUID() },
  ])("answers BOHDAN's list of $case with 404 not_found", async ({ searchOf }) => {
    const { olena, bohdan, archivedSearchId } = await olenaWithNoise();

    const response = await getWithQuery(testApp.app, {
      path: APPLICATIONS_PATH,
      accessToken: bohdan.accessToken,
      query: { searchId: searchOf(olena, archivedSearchId) },
    });

    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(response.body)).toMatchObject({
      type: 'not_found',
      detail: 'Search not found',
    });
  });

  it.each([
    {
      query: { stage: 'applied,final' },
      companies: ['Yasen Tech', 'Smereka Soft', 'Kavun Labs', 'Dub Data', 'Buk Cloud'],
    },
    { query: { stage: 'offer' }, companies: ['Lypa Pay'] },
    { query: { source: 'dou' }, companies: ['Smereka Soft', 'Dub Data', 'Klen Games'] },
    { query: { source: 'djinni,referral' }, companies: ['Kavun Labs', 'Buk Cloud', 'Lypa Pay'] },
    { query: { q: 'kavun' }, companies: ['Smereka Soft', 'Kavun Labs'] },
    { query: { q: 'KaVuN' }, companies: ['Smereka Soft', 'Kavun Labs'] },
    {
      query: { hasScore: 'true' },
      companies: ['Yasen Tech', 'Kavun Labs', 'Buk Cloud', 'Lypa Pay'],
    },
    { query: { hasScore: 'false' }, companies: ['Smereka Soft', 'Dub Data', 'Klen Games'] },
    { query: { silence: 'silent' }, companies: ['Kavun Labs', 'Buk Cloud'] },
    { query: { silence: 'warn' }, companies: ['Smereka Soft', 'Dub Data'] },
    { query: { silence: 'none' }, companies: ['Yasen Tech', 'Lypa Pay', 'Klen Games'] },
    {
      query: { silence: 'warn,silent' },
      companies: ['Smereka Soft', 'Kavun Labs', 'Dub Data', 'Buk Cloud'],
    },
    { query: { source: 'dou', hasScore: 'false', stage: 'final' }, companies: ['Dub Data'] },
  ])('lists $companies for $query', async ({ query, companies }) => {
    const olena = await signedInWithSearch(testApp.prisma);
    await rowsFor(olena, FILTER_ROWS);

    const page = await listApplications(testApp.app, { accessToken: olena.accessToken, query });

    expect(companiesOf(page)).toEqual(companies);
  });

  it.each([
    {
      query: { source: 'dou,djinni', silence: 'warn,none' },
      columns: {
        applied: { count: 1, companies: ['Smereka Soft'] },
        final: { count: 1, companies: ['Dub Data'] },
        rejected: { count: 1, companies: null },
      },
    },
    {
      query: { q: 'kavun', hasScore: 'false' },
      columns: { applied: { count: 1, companies: ['Smereka Soft'] } },
    },
    {
      query: { source: 'dou', expand: 'rejected' },
      columns: {
        applied: { count: 1, companies: ['Smereka Soft'] },
        final: { count: 1, companies: ['Dub Data'] },
        rejected: { count: 1, companies: ['Klen Games'] },
      },
    },
  ])(
    'counts and shows on the board only the applications that $query keeps',
    async ({ query, columns }) => {
      const olena = await signedInWithSearch(testApp.prisma);
      await rowsFor(olena, FILTER_ROWS);

      const board = await getApplicationBoard(testApp.app, {
        accessToken: olena.accessToken,
        query,
      });

      expect(columnViewsOf(board)).toEqual({ ...EMPTY_BOARD, ...columns });
    },
  );

  it.each([
    { q: '%', companies: ['Знижка 100%'] },
    { q: '_', companies: ['Софт_1'] },
    { q: 'Софт_1', companies: ['Софт_1'] },
    { q: '\\', companies: ['Back\\slash'] },
  ])('matches q $q as literal text on the list and the board', async ({ q, companies }) => {
    const olena = await signedInWithSearch(testApp.prisma);
    await rowsFor(olena, LIKE_PATTERN_ROWS);
    const { accessToken } = olena;

    const list = await listApplications(testApp.app, { accessToken, query: { q } });
    const board = await getApplicationBoard(testApp.app, { accessToken, query: { q } });

    expect(companiesOf(list)).toEqual(companies);
    expect(columnViewsOf(board).applied).toEqual({ count: companies.length, companies });
  });

  it.each([
    {
      sort: '-lastEventAt',
      pages: [
        ['Newest', 'Tied 4'],
        ['Tied 3', 'Tied 2'],
        ['Tied 1', 'Oldest'],
      ],
    },
    {
      sort: 'lastEventAt',
      pages: [
        ['Oldest', 'Tied 1'],
        ['Tied 2', 'Tied 3'],
        ['Tied 4', 'Newest'],
      ],
    },
  ])(
    'walks pages of 2 by $sort through tied lastEventAt rows once each and ends with no cursor',
    async ({ sort, pages }) => {
      const olena = await signedInWithSearch(testApp.prisma);
      await rowsFor(olena, PAGE_ROWS);

      expect(await walkPages({ accessToken: olena.accessToken, sort })).toEqual(pages);
    },
  );

  it('builds the card from the earliest future planned event, the latest AI job, three stack items and the days since the last stage event', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const [cardId = '', bareId = ''] = await rowsFor(olena, [
      {
        company: 'Kavun Labs',
        position: 'Backend engineer',
        source: 'djinni',
        salaryMin: 3000,
        salaryMax: 4500,
        currency: 'USD',
        stack: ['TypeScript', 'NestJS', 'PostgreSQL', 'Redis', 'Docker'],
        matchScore: 78,
        currentStage: 'screening',
        lastEventAt: daysBefore(2),
        createdAt: daysBefore(10),
      },
      { company: 'Smereka Soft', lastEventAt: daysBefore(5), createdAt: daysBefore(5) },
    ]);
    await createStageEvents(testApp.prisma, [
      { applicationId: cardId, fromStage: null, toStage: 'applied', occurredAt: daysBefore(10) },
      {
        applicationId: cardId,
        fromStage: 'applied',
        toStage: 'screening',
        occurredAt: daysBefore(3),
      },
    ]);
    for (const event of [
      { kind: 'tech_interview', startsAt: minutesAfter(2 * 24 * 60) },
      { kind: 'screening_call', startsAt: minutesAfter(240) },
      { kind: 'other', startsAt: minutesBefore(60) },
      { kind: 'other', startsAt: minutesAfter(60), status: 'cancelled' },
    ] as const) {
      await createScheduledEvent(testApp.prisma, { applicationId: cardId, ...event });
    }
    for (const status of ['failed', 'processing'] as const) {
      await createAiJob(testApp.prisma, { userId: olena.userId, applicationId: cardId, status });
    }

    const list = await listApplications(testApp.app, { accessToken: olena.accessToken });
    const board = await getApplicationBoard(testApp.app, { accessToken: olena.accessToken });

    const card = {
      id: cardId,
      company: 'Kavun Labs',
      position: 'Backend engineer',
      source: 'djinni',
      salaryMin: 3000,
      salaryMax: 4500,
      currency: 'USD',
      matchScore: 78,
      currentStage: 'screening',
      isDraft: false,
      lastEventAt: '2026-10-20T09:00:00.000Z',
      daysInStage: 3,
      daysSinceLastEvent: 2,
      silenceLevel: 'none',
      stack: ['TypeScript', 'NestJS', 'PostgreSQL'],
      stackCount: 5,
      nextScheduledEvent: { kind: 'screening_call', startsAt: '2026-10-22T13:00:00.000Z' },
      aiStatus: 'processing',
    } satisfies ApplicationCard;
    expect(list.items[0]).toEqual(card);
    expect(board.columns.screening.items).toEqual([card]);
    expect(list.items[1]).toMatchObject({
      id: bareId,
      stack: [],
      stackCount: 0,
      nextScheduledEvent: null,
      aiStatus: null,
      daysInStage: 5,
    });
  });

  it.each([
    { path: APPLICATIONS_PATH, query: { stage: 'hired' }, error: 'stage.0' },
    { path: APPLICATIONS_PATH, query: { limit: '0' }, error: 'limit' },
    { path: APPLICATIONS_PATH, query: { cursor: 'not-a-cursor' }, error: 'cursor' },
    { path: APPLICATIONS_PATH, query: { sort: 'createdAt' }, error: 'sort' },
    { path: APPLICATIONS_PATH, query: { hasScore: 'yes' }, error: 'hasScore' },
    { path: APPLICATIONS_PATH, query: { searchId: '42' }, error: 'searchId' },
    { path: APPLICATIONS_PATH, query: { q: 'a\u0000b' }, error: 'q' },
    { path: APPLICATIONS_BOARD_PATH, query: { expand: 'offer' }, error: 'expand.0' },
    { path: APPLICATIONS_BOARD_PATH, query: { q: 'a\u0000b' }, error: 'q' },
  ])('answers GET $path with $query by 422 at $error', async ({ path, query, error }) => {
    const { accessToken } = await signedInWithSearch(testApp.prisma);

    const response = await getWithQuery(testApp.app, { path, accessToken, query });

    expect(response.status).toBe(422);
    expect(errorResponseSchema.parse(response.body).type).toBe('validation_error');
    expect(errorPaths(response.body)).toEqual([error]);
  });

  it.each([APPLICATIONS_PATH, APPLICATIONS_BOARD_PATH])(
    'answers GET %s without a token with 401',
    async (path) => {
      const response = await callRoute(testApp.app, { method: 'get', path });

      expect(response.status).toBe(401);
      expect(errorResponseSchema.parse(response.body).type).toBe('unauthorized');
    },
  );

  it('answers GET /applications/board with the board and GET /applications/:id with the application', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const [id = ''] = await rowsFor(olena, [{ lastEventAt: daysBefore(1) }]);
    const { accessToken } = olena;

    const board = await callRoute(testApp.app, {
      method: 'get',
      path: APPLICATIONS_BOARD_PATH,
      accessToken,
    });
    const single = await callRoute(testApp.app, {
      method: 'get',
      path: applicationPath(id),
      accessToken,
    });

    expect([board.status, single.status]).toEqual([200, 200]);
    expect(applicationBoardResponseSchema.parse(board.body).columns.applied.count).toBe(1);
    expect(applicationResponseSchema.parse(single.body).id).toBe(id);
  });
});
