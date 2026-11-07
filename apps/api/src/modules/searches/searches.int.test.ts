import { randomUUID } from 'node:crypto';

import {
  type ApplicationBoardResponse,
  type ApplicationListResponse,
  applicationResponseSchema,
  DEFAULT_SEARCH_TITLE,
  type FinishSearchInput,
  finishSearchResponseSchema,
  type MoveApplicationInput,
  searchListResponseSchema,
  type Stage,
} from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { Prisma } from '../../generated/prisma/client.js';
import {
  applicationEventRow,
  applicationPath,
  createMovedApplication,
  getApplicationBoard,
  getWithQuery,
  listApplications,
  REASONS_SUMMARY_PATH,
  type SignedInSearcher,
  signedInWithSearch,
  timelinePath,
  useStageMoveTestApp,
} from '../../test/applications.js';
import { queuedBehindRowLock } from '../../test/database.js';
import {
  type ApplicationRowInput,
  createApplicationRows,
  createStageEvents,
} from '../../test/factories.js';
import { callRoute, errorPathsOf, statusAndDetail } from '../../test/http.js';
import { outboxRows } from '../../test/outbox.js';
import { FINISH_SEARCH_PATH, finishSearch, SEARCHES_PATH } from '../../test/searches.js';
import {
  rejectedAfterTechInterview,
  SCREENING_TO_TECH_INTERVIEW,
  TO_SCREENING,
  TO_TECH_INTERVIEW,
} from '../../test/service-fixtures.js';
import { daysBefore, NOW, settableClock } from '../../test/time.js';

type CardMoves = { moves: MoveApplicationInput[]; daysAgo: number };

type DatedEvent = Omit<Prisma.StageEventCreateManyInput, 'applicationId' | 'occurredAt'> & {
  daysAgo: number;
};

type BoardColumn = ApplicationBoardResponse['columns'][Stage];

type SeededCard = { row?: Partial<ApplicationRowInput>; events: DatedEvent[] };

type CountedNoise = {
  case: string;
  seed: (olena: SignedInSearcher, countedId: string) => Promise<unknown>;
};

const clock = settableClock(NOW);

const FIRST_SEARCH = { startedAt: daysBefore(41), title: 'Перший пошук' };

const TECH_INTERVIEW_MOVES: MoveApplicationInput[] = [TO_SCREENING, SCREENING_TO_TECH_INTERVIEW];

const OFFER_MOVES: MoveApplicationInput[] = [
  TO_TECH_INTERVIEW,
  { fromStage: 'tech_interview', toStage: 'offer' },
];

const OFFER_PATH: DatedEvent[] = [
  { fromStage: null, toStage: 'applied', daysAgo: 30 },
  { fromStage: 'applied', toStage: 'tech_interview', daysAgo: 20 },
  { fromStage: 'tech_interview', toStage: 'offer', daysAgo: 10 },
];

const FINISHED_FIRST_SEARCH = {
  title: 'Перший пошук',
  status: 'archived',
  startedAt: '2026-09-11T09:00:00.000Z',
  finishedAt: '2026-10-22T09:00:00.000Z',
  days: 41,
};

const FRESH_SEARCH = {
  title: DEFAULT_SEARCH_TITLE,
  status: 'active',
  outcome: null,
  startedAt: '2026-10-22T09:00:00.000Z',
  finishedAt: null,
  days: 0,
  applications: 0,
  interviews: 0,
  offers: 0,
  daysToOffer: null,
};

const ZERO_COUNTS = [0, 0, 0, 0, 0, 0, 0, 0];

const stagesById = ({ items }: ApplicationListResponse) =>
  Object.fromEntries(items.map(({ id, currentStage }) => [id, currentStage]));

const cardIdsOf = ({ items }: BoardColumn) => items?.map(({ id }) => id);

const finishOf = (searchId: string, change: Partial<FinishSearchInput> = {}) => ({
  searchId,
  outcome: 'offer_accepted',
  openApplications: 'withdraw',
  ...change,
});

describe('the search routes', () => {
  const testApp = useStageMoveTestApp(clock);

  const cardOf = ({ accessToken }: SignedInSearcher, card: CardMoves) =>
    createMovedApplication(testApp.app, { ...card, clock, accessToken });

  const finishAs = ({ accessToken }: SignedInSearcher, input: object) =>
    finishSearch(testApp.app, { accessToken, input });

  async function finishedAs(searcher: SignedInSearcher, change: Partial<FinishSearchInput> = {}) {
    const response = await finishAs(searcher, finishOf(searcher.searchId, change));
    expect(response.status).toBe(200);
    return finishSearchResponseSchema.parse(response.body);
  }

  const searchesOf = ({ accessToken }: SignedInSearcher) =>
    getWithQuery(testApp.app, { path: SEARCHES_PATH, accessToken });

  const activeSearchIds = async ({ userId }: SignedInSearcher) => {
    const searches = await testApp.prisma.search.findMany({
      where: { userId, status: 'active' },
      select: { id: true },
    });
    return searches.map(({ id }) => id);
  };

  async function timelineOf({ accessToken }: SignedInSearcher, id: string): Promise<unknown> {
    const response = await callRoute(testApp.app, {
      method: 'get',
      path: timelinePath(id),
      accessToken,
    });
    expect(response.status).toBe(200);
    return response.body;
  }

  async function seedCard(owner: SignedInSearcher, { row, events }: SeededCard) {
    const [applicationId = ''] = await createApplicationRows(testApp.prisma, {
      userId: owner.userId,
      searchId: owner.searchId,
      rows: [{ currentStage: 'offer', lastEventAt: daysBefore(10), ...row }],
    });
    await addEvents(applicationId, events);
    return applicationId;
  }

  const addEvents = (applicationId: string, events: DatedEvent[]) =>
    createStageEvents(
      testApp.prisma,
      events.map(({ daysAgo, ...event }) => ({
        ...event,
        applicationId,
        occurredAt: daysBefore(daysAgo),
      })),
    );

  async function undoneInterview(applicationId: string): Promise<void> {
    const undoneId = randomUUID();
    await addEvents(applicationId, [
      { id: undoneId, fromStage: 'tech_interview', toStage: 'final', daysAgo: 15 },
    ]);
    await addEvents(applicationId, [
      { fromStage: 'final', toStage: 'tech_interview', daysAgo: 15, compensatesEventId: undoneId },
    ]);
  }

  const eventAt = (toStage: Stage, daysAgo: number): DatedEvent[] => [
    { fromStage: 'applied', toStage, daysAgo },
  ];

  const COUNTED_NOISE: CountedNoise[] = [
    {
      case: 'a draft',
      seed: (olena) => seedCard(olena, { row: { isDraft: true }, events: OFFER_PATH }),
    },
    {
      case: 'a deleted card',
      seed: (olena) => seedCard(olena, { row: { deletedAt: daysBefore(1) }, events: OFFER_PATH }),
    },
    { case: 'an undone interview round', seed: (_olena, countedId) => undoneInterview(countedId) },
    {
      case: 'a screening event',
      seed: (_olena, countedId) => addEvents(countedId, eventAt('screening', 25)),
    },
    {
      case: 'an interview before the search started',
      seed: (_olena, countedId) => addEvents(countedId, eventAt('tech_interview', 50)),
    },
    {
      case: 'an offer before the search started',
      seed: (_olena, countedId) => addEvents(countedId, eventAt('offer', 45)),
    },
    {
      case: "BOHDAN's search and cards",
      seed: async () => {
        const bohdan = await signedInWithSearch(testApp.prisma, FIRST_SEARCH);
        return seedCard(bohdan, { events: OFFER_PATH });
      },
    },
  ];

  it("finishes OLENA's search with an accepted offer: withdraws her open cards, empties the board and keeps the finished search readable by its id", async () => {
    const olena = await signedInWithSearch(testApp.prisma, FIRST_SEARCH);
    const bohdan = await signedInWithSearch(testApp.prisma, FIRST_SEARCH);
    const screening = await cardOf(olena, { moves: [TO_SCREENING], daysAgo: 40 });
    const techInterview = await cardOf(olena, { moves: TECH_INTERVIEW_MOVES, daysAgo: 30 });
    const offer = await cardOf(olena, { moves: OFFER_MOVES, daysAgo: 5 });
    const rejected = await cardOf(olena, {
      moves: rejectedAfterTechInterview('skills_gap'),
      daysAgo: 10,
    });
    const bohdansCard = await cardOf(bohdan, { moves: TECH_INTERVIEW_MOVES, daysAgo: 30 });

    const { finished, current } = await finishedAs(olena);

    expect([finished, current]).toEqual([
      {
        ...FINISHED_FIRST_SEARCH,
        id: olena.searchId,
        outcome: 'offer_accepted',
        applications: 4,
        interviews: 3,
        offers: 1,
        daysToOffer: 38,
      },
      { ...FRESH_SEARCH, id: current.id },
    ]);
    expect(await activeSearchIds(olena)).toEqual([current.id]);
    const board = await getApplicationBoard(testApp.app, { accessToken: olena.accessToken });
    expect(Object.values(board.columns).map(({ count }) => count)).toEqual(ZERO_COUNTS);
    const old = await listApplications(testApp.app, {
      accessToken: olena.accessToken,
      query: { searchId: olena.searchId },
    });
    expect(stagesById(old)).toEqual({
      [screening]: 'withdrawn',
      [techInterview]: 'withdrawn',
      [offer]: 'offer',
      [rejected]: 'rejected',
    });
    const reasons = await getWithQuery(testApp.app, {
      path: REASONS_SUMMARY_PATH,
      accessToken: olena.accessToken,
      query: { stage: 'tech_interview', searchId: olena.searchId },
    });
    expect(reasons.body).toEqual({
      stage: 'tech_interview',
      total: 1,
      reasons: [{ code: 'skills_gap', count: 1 }],
    });
    const searches = await searchesOf(olena);
    expect(searchListResponseSchema.parse(searches.body)).toEqual({ items: [current, finished] });
    const withdrawnRows = await outboxRows(testApp.prisma, {
      eventType: 'application.stage_changed',
      payload: { path: ['toStage'], equals: 'withdrawn' },
    });
    expect(withdrawnRows).toEqual(
      [
        { applicationId: screening, fromStage: 'screening' as const },
        { applicationId: techInterview, fromStage: 'tech_interview' as const },
      ].map((change) =>
        applicationEventRow({
          ...change,
          eventType: 'application.stage_changed',
          toStage: 'withdrawn',
          reasonCode: null,
          compensatesEventId: null,
          userId: olena.userId,
        }),
      ),
    );
    const bohdansBoard = await getApplicationBoard(testApp.app, {
      accessToken: bohdan.accessToken,
    });
    expect(cardIdsOf(bohdansBoard.columns.tech_interview)).toEqual([bohdansCard]);
  });

  it('moves her open cards with their whole history into the new search and leaves the offer and a deleted card in the finished one', async () => {
    const olena = await signedInWithSearch(testApp.prisma, FIRST_SEARCH);
    const techInterview = await cardOf(olena, { moves: TECH_INTERVIEW_MOVES, daysAgo: 30 });
    const offer = await cardOf(olena, { moves: OFFER_MOVES, daysAgo: 5 });
    const [draft = '', deleted = ''] = await createApplicationRows(testApp.prisma, {
      userId: olena.userId,
      searchId: olena.searchId,
      rows: [
        { isDraft: true, lastEventAt: daysBefore(2) },
        { currentStage: 'screening', deletedAt: daysBefore(1), lastEventAt: daysBefore(2) },
      ],
    });
    const timelineBefore = await timelineOf(olena, techInterview);
    const stageEventsBefore = await testApp.prisma.stageEvent.count({
      where: { applicationId: techInterview },
    });
    const stageChangedBefore = await outboxRows(testApp.prisma, {
      eventType: 'application.stage_changed',
    });

    const { finished, current } = await finishedAs(olena, {
      outcome: 'paused',
      openApplications: 'move',
    });

    expect([finished, current]).toEqual([
      {
        ...FINISHED_FIRST_SEARCH,
        id: olena.searchId,
        outcome: 'paused',
        applications: 1,
        interviews: 1,
        offers: 1,
        daysToOffer: 38,
      },
      { ...FRESH_SEARCH, id: current.id, applications: 1 },
    ]);
    expect(await timelineOf(olena, techInterview)).toEqual(timelineBefore);
    expect(await testApp.prisma.stageEvent.count({ where: { applicationId: techInterview } })).toBe(
      stageEventsBefore,
    );
    const moved = await callRoute(testApp.app, {
      method: 'get',
      path: applicationPath(techInterview),
      accessToken: olena.accessToken,
    });
    expect(applicationResponseSchema.parse(moved.body).searchId).toBe(current.id);
    const board = await getApplicationBoard(testApp.app, { accessToken: olena.accessToken });
    expect([board.columns.applied, board.columns.tech_interview].map(cardIdsOf)).toEqual([
      [draft],
      [techInterview],
    ]);
    const old = await listApplications(testApp.app, {
      accessToken: olena.accessToken,
      query: { searchId: olena.searchId },
    });
    expect(old.items.map(({ id }) => id)).toEqual([offer]);
    const stored = await testApp.prisma.application.findUniqueOrThrow({
      where: { id: deleted },
      select: { searchId: true },
    });
    expect(stored.searchId).toBe(olena.searchId);
    expect(await outboxRows(testApp.prisma, { eventType: 'application.updated' })).toEqual(
      [techInterview, draft].map((applicationId) =>
        applicationEventRow({
          eventType: 'application.updated',
          applicationId,
          fields: ['searchId'],
          userId: olena.userId,
        }),
      ),
    );
    expect(await outboxRows(testApp.prisma, { eventType: 'application.stage_changed' })).toEqual(
      stageChangedBefore,
    );
  });

  it.each(COUNTED_NOISE)("leaves $case out of OLENA's search totals", async ({ seed }) => {
    const olena = await signedInWithSearch(testApp.prisma, FIRST_SEARCH);
    const countedId = await seedCard(olena, { events: OFFER_PATH });
    await seed(olena, countedId);

    const response = await searchesOf(olena);

    expect([response.status, response.body]).toEqual([
      200,
      {
        items: [
          {
            id: olena.searchId,
            title: 'Перший пошук',
            status: 'active',
            outcome: null,
            startedAt: '2026-09-11T09:00:00.000Z',
            finishedAt: null,
            days: 41,
            applications: 1,
            interviews: 1,
            offers: 1,
            daysToOffer: 31,
          },
        ],
      },
    ]);
  });

  it('answers the loser of two concurrent finishes of the same search and a repeat with the finished id with the same 409, keeping one active search', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const finish = () => finishAs(olena, finishOf(olena.searchId));

    const pair = await queuedBehindRowLock(testApp.prisma, {
      lock: Prisma.sql`SELECT id FROM searches WHERE id = ${olena.searchId}::uuid FOR UPDATE`,
      calls: [finish, finish],
    });

    expect(pair.map(({ status }) => status).sort((left, right) => left - right)).toEqual([
      200, 409,
    ]);
    expect(await activeSearchIds(olena)).toHaveLength(1);
    const repeat = await finish();
    expect(pair.map(statusAndDetail)).toContainEqual([409, 'The search is already finished']);
    expect(statusAndDetail(repeat)).toEqual([409, 'The search is already finished']);
    expect(await activeSearchIds(olena)).toHaveLength(1);
  });

  it("answers 409 'The search is already finished' when OLENA has no active search, even while BOHDAN's is active, and starts none", async () => {
    const olena = await signedInWithSearch(testApp.prisma, { status: 'archived' });
    const bohdan = await signedInWithSearch(testApp.prisma);

    const response = await finishAs(olena, finishOf(olena.searchId));

    expect(statusAndDetail(response)).toEqual([409, 'The search is already finished']);
    expect([await activeSearchIds(olena), await activeSearchIds(bohdan)]).toEqual([
      [],
      [bohdan.searchId],
    ]);
  });

  it("answers BOHDAN's searchId with 404 and leaves both searches active", async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);

    const response = await finishAs(olena, finishOf(bohdan.searchId));

    expect(statusAndDetail(response)).toEqual([404, 'Search not found']);
    expect([await activeSearchIds(olena), await activeSearchIds(bohdan)]).toEqual([
      [olena.searchId],
      [bohdan.searchId],
    ]);
  });

  it('answers a non-uuid searchId, an unknown outcome and a per-application list with 422 at each field and keeps the search active', async () => {
    const olena = await signedInWithSearch(testApp.prisma);

    const response = await finishAs(olena, {
      searchId: 'not-a-uuid',
      outcome: 'hired',
      openApplications: [olena.searchId],
    });

    expect([response.status, errorPathsOf(response.body)]).toEqual([
      422,
      ['searchId', 'outcome', 'openApplications'],
    ]);
    expect(await activeSearchIds(olena)).toEqual([olena.searchId]);
  });

  it('answers both search routes without a token with 401', async () => {
    const responses = await Promise.all([
      callRoute(testApp.app, { method: 'get', path: SEARCHES_PATH }),
      callRoute(testApp.app, { method: 'post', path: FINISH_SEARCH_PATH, body: {} }),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([401, 401]);
  });
});
