import type { ApplicationCard, Stage } from '@jobflow/shared';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { BOHDAN_ID, OLENA_ID, SEARCH_ID } from '../../test/service-fixtures.js';
import { daysBefore, NOW } from '../../test/time.js';
import { applicationCursorSchema, type ApplicationListRequest } from './application-cursor.js';
import {
  type ApplicationListFilter,
  ApplicationListRepository,
  type CardRow,
  type FindCards,
  type StageCount,
} from './application-list.repository.js';
import { ApplicationListService } from './application-list.service.js';

type OwnedSearch = { userId: string; id: string };

type FakeData = {
  cards?: CardRow[];
  counts?: StageCount[];
  silenceDays?: number;
  searches?: OwnedSearch[];
};

type CardQuery = FindCards & { userId: string };

type CountQuery = { userId: string; filter: ApplicationListFilter };

const MISSING_SEARCH_ID = '0199f0a0-0000-7000-8000-0000000000a2';

const FIRST_PAGE: ApplicationListRequest = { sort: '-lastEventAt', limit: 2 };

const CARD_ROW: CardRow = {
  id: '0199f0a0-0000-7000-8000-0000000000c1',
  company: 'Смерека Софт',
  position: 'Backend engineer',
  source: 'dou',
  salaryMin: 3000,
  salaryMax: 4000,
  currency: 'USD',
  stack: ['Go', 'Kafka', 'Redis', 'gRPC', 'Kubernetes'],
  matchScore: 81,
  currentStage: 'screening',
  isDraft: false,
  lastEventAt: daysBefore(4),
  createdAt: daysBefore(10),
  stageEvents: [{ occurredAt: daysBefore(6) }],
  scheduledEvents: [{ kind: 'screening_call', startsAt: new Date('2026-10-22T13:00:00.000Z') }],
  aiJobs: [{ status: 'processing' }],
};

const rowAt = (stage: Stage, index: number): CardRow => ({
  ...CARD_ROW,
  id: `0199f0a0-0000-7000-8000-0000000001${String(index).padStart(2, '0')}`,
  currentStage: stage,
  lastEventAt: daysBefore(index),
});

class FakeApplicationListRepository {
  readonly cardQueries: CardQuery[] = [];

  readonly countQueries: CountQuery[] = [];

  constructor(private readonly data: Required<FakeData>) {}

  findSilenceDays(): Promise<number> {
    return Promise.resolve(this.data.silenceDays);
  }

  searchExists(userId: string, searchId: string): Promise<boolean> {
    return Promise.resolve(
      this.data.searches.some((search) => search.userId === userId && search.id === searchId),
    );
  }

  countByStage(userId: string, filter: ApplicationListFilter): Promise<StageCount[]> {
    this.countQueries.push({ userId, filter });
    return Promise.resolve(this.data.counts);
  }

  findCards(userId: string, query: FindCards): Promise<CardRow[]> {
    this.cardQueries.push({ userId, ...query });
    const { stages, take } = query;
    const rows = this.data.cards.filter((row) => stages?.includes(row.currentStage) ?? true);
    return Promise.resolve(rows.slice(0, take));
  }
}

async function serviceWith({
  cards = [CARD_ROW],
  counts = [],
  silenceDays = 7,
  searches = [{ userId: OLENA_ID, id: SEARCH_ID }],
}: FakeData = {}) {
  const repository = new FakeApplicationListRepository({ cards, counts, silenceDays, searches });
  const moduleRef = await Test.createTestingModule({
    providers: [ApplicationListService, ApplicationListRepository, Clock],
  })
    .overrideProvider(ApplicationListRepository)
    .useValue(repository)
    .overrideProvider(Clock)
    .useValue({ now: () => NOW })
    .compile();
  return { repository, service: moduleRef.get(ApplicationListService) };
}

const itemsByStage = (columns: Record<Stage, { items: ApplicationCard[] | null }>) =>
  Object.fromEntries(
    Object.entries(columns).map(([stage, { items }]) => [
      stage,
      items?.map(({ id }) => id) ?? null,
    ]),
  );

describe('ApplicationListService.list', () => {
  it.each([
    { case: "another user's search", userId: BOHDAN_ID, searchId: SEARCH_ID },
    { case: 'a missing search', userId: OLENA_ID, searchId: MISSING_SEARCH_ID },
  ])('answers $case with 404 and reads no cards', async ({ userId, searchId }) => {
    const { repository, service } = await serviceWith();

    await expect(service.list(userId, { ...FIRST_PAGE, searchId })).rejects.toMatchObject({
      body: { status: 404, type: 'not_found', detail: 'Search not found' },
    });
    expect(repository.cardQueries).toEqual([]);
  });

  it("reads the owner's search by its id", async () => {
    const { repository, service } = await serviceWith();

    await service.list(OLENA_ID, { ...FIRST_PAGE, searchId: SEARCH_ID });

    expect(repository.cardQueries.map(({ userId, filter }) => ({ userId, filter }))).toEqual([
      { userId: OLENA_ID, filter: { searchId: SEARCH_ID } },
    ]);
  });

  it('asks for one row past the limit with the sort, the cursor, the filters and the clock time', async () => {
    const { repository, service } = await serviceWith();
    const cursor = { lastEventAt: daysBefore(3), id: CARD_ROW.id };

    await service.list(OLENA_ID, {
      sort: 'lastEventAt',
      limit: 20,
      cursor,
      stage: ['applied'],
      source: ['dou'],
      q: 'смерека',
      hasScore: true,
    });

    expect(repository.cardQueries).toEqual([
      {
        userId: OLENA_ID,
        filter: { stage: ['applied'], source: ['dou'], q: 'смерека', hasScore: true },
        sort: 'lastEventAt',
        cursor,
        take: 21,
        now: NOW,
      },
    ]);
  });

  it('gives a nextCursor at the last kept row when one row more than the limit came back', async () => {
    const { service } = await serviceWith({
      cards: [rowAt('applied', 1), rowAt('applied', 2), rowAt('applied', 3)],
    });

    const page = await service.list(OLENA_ID, FIRST_PAGE);

    expect(page.items.map(({ id }) => id)).toEqual([
      '0199f0a0-0000-7000-8000-000000000101',
      '0199f0a0-0000-7000-8000-000000000102',
    ]);
    expect(applicationCursorSchema.parse(page.nextCursor)).toEqual({
      lastEventAt: new Date('2026-10-20T09:00:00.000Z'),
      id: '0199f0a0-0000-7000-8000-000000000102',
    });
  });

  it.each([
    { case: 'exactly the limit came back', rows: 2 },
    { case: 'fewer rows than the limit came back', rows: 1 },
    { case: 'no row came back', rows: 0 },
  ])('gives no nextCursor when $case', async ({ rows }) => {
    const cards = [rowAt('applied', 1), rowAt('applied', 2)].slice(0, rows);
    const { service } = await serviceWith({ cards });

    const page = await service.list(OLENA_ID, FIRST_PAGE);

    expect([page.items.length, page.nextCursor]).toEqual([rows, null]);
  });

  it("turns the silence levels into lastEventAt windows from the user's silenceDays and the clock", async () => {
    const { repository, service } = await serviceWith({ silenceDays: 3 });

    await service.list(OLENA_ID, { ...FIRST_PAGE, silence: ['warn'] });

    expect(repository.cardQueries[0]?.filter).toEqual({
      silenceWindows: [
        {
          stages: ['applied', 'screening', 'tech_interview'],
          lastEventAfter: new Date('2026-10-19T09:00:00.000Z'),
          lastEventAtOrBefore: new Date('2026-10-20T09:00:00.000Z'),
        },
        {
          stages: ['final'],
          lastEventAfter: new Date('2026-10-16T09:00:00.000Z'),
          lastEventAtOrBefore: new Date('2026-10-19T09:00:00.000Z'),
        },
      ],
    });
  });
});

describe('ApplicationListService.board', () => {
  it('fills every stage, giving a stage without applications count 0', async () => {
    const { service } = await serviceWith({ cards: [], counts: [{ stage: 'applied', count: 2 }] });

    const board = await service.board(OLENA_ID, {});

    expect(board.columns).toEqual({
      applied: { count: 2, items: [] },
      screening: { count: 0, items: [] },
      tech_interview: { count: 0, items: [] },
      final: { count: 0, items: [] },
      offer: { count: 0, items: [] },
      rejected: { count: 0, items: null },
      ghosted: { count: 0, items: null },
      withdrawn: { count: 0, items: null },
    });
  });

  it.each([
    {
      expand: undefined,
      shown: ['applied', 'screening', 'tech_interview', 'final', 'offer'],
      collapsed: ['rejected', 'ghosted', 'withdrawn'],
    },
    {
      expand: ['rejected', 'ghosted'] as const,
      shown: ['applied', 'screening', 'tech_interview', 'final', 'offer', 'rejected', 'ghosted'],
      collapsed: ['withdrawn'],
    },
  ])(
    'reads cards for $shown and keeps only the count for $collapsed',
    async ({ expand, shown, collapsed }) => {
      const cards = [rowAt('applied', 1), rowAt('rejected', 2), rowAt('ghosted', 3)];
      const { repository, service } = await serviceWith({ cards });

      const board = await service.board(OLENA_ID, expand ? { expand: [...expand] } : {});

      expect(repository.cardQueries.map(({ stages }) => stages)).toEqual([shown]);
      const items = itemsByStage(board.columns);
      expect(collapsed.map((stage) => items[stage])).toEqual(collapsed.map(() => null));
      expect(shown.every((stage) => Array.isArray(items[stage]))).toBe(true);
    },
  );

  it('keeps the full groupBy count, read with the same filter as the cards, next to the cards of a column, newest first as read', async () => {
    const cards = [rowAt('applied', 1), rowAt('screening', 2), rowAt('applied', 3)];
    const counts = [
      { stage: 'applied', count: 41 },
      { stage: 'rejected', count: 12 },
    ] satisfies StageCount[];
    const { repository, service } = await serviceWith({ cards, counts });

    const board = await service.board(OLENA_ID, { source: ['djinni'] });

    expect(board.columns.applied).toMatchObject({ count: 41 });
    expect(itemsByStage(board.columns)).toMatchObject({
      applied: ['0199f0a0-0000-7000-8000-000000000101', '0199f0a0-0000-7000-8000-000000000103'],
      screening: ['0199f0a0-0000-7000-8000-000000000102'],
      rejected: null,
    });
    expect(board.columns.rejected).toEqual({ count: 12, items: null });
    expect(repository.cardQueries).toEqual([
      {
        userId: OLENA_ID,
        filter: { source: ['djinni'] },
        stages: ['applied', 'screening', 'tech_interview', 'final', 'offer'],
        sort: '-lastEventAt',
        now: NOW,
      },
    ]);
    expect(repository.countQueries).toEqual([{ userId: OLENA_ID, filter: { source: ['djinni'] } }]);
  });
});

describe('the application card', () => {
  it('carries the first three stack items, the full stack count, the next event, the AI status and the timing', async () => {
    const { service } = await serviceWith();

    const page = await service.list(OLENA_ID, FIRST_PAGE);

    expect(page.items).toEqual([
      {
        id: '0199f0a0-0000-7000-8000-0000000000c1',
        company: 'Смерека Софт',
        position: 'Backend engineer',
        source: 'dou',
        salaryMin: 3000,
        salaryMax: 4000,
        currency: 'USD',
        matchScore: 81,
        currentStage: 'screening',
        isDraft: false,
        lastEventAt: '2026-10-18T09:00:00.000Z',
        stack: ['Go', 'Kafka', 'Redis'],
        stackCount: 5,
        nextScheduledEvent: { kind: 'screening_call', startsAt: '2026-10-22T13:00:00.000Z' },
        aiStatus: 'processing',
        daysInStage: 6,
        daysSinceLastEvent: 4,
        silenceLevel: 'warn',
      },
    ] satisfies ApplicationCard[]);
  });

  it('gives null for no planned event and no AI job, and counts days in stage from createdAt without a stage event', async () => {
    const row = { ...CARD_ROW, stageEvents: [], scheduledEvents: [], aiJobs: [], stack: ['Go'] };
    const { service } = await serviceWith({ cards: [row], silenceDays: 3 });

    const page = await service.list(OLENA_ID, FIRST_PAGE);

    expect(page.items[0]).toMatchObject({
      stack: ['Go'],
      stackCount: 1,
      nextScheduledEvent: null,
      aiStatus: null,
      daysInStage: 10,
      silenceLevel: 'silent',
    });
  });
});
