import type { FinishSearchInput } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import type { ByUser } from '../../test/recorded-events.js';
import { BOHDAN_ID, MISSING_ID, OLENA_ID, SEARCH_ID } from '../../test/service-fixtures.js';
import { daysBefore, NOW } from '../../test/time.js';
import {
  type HandOver,
  SearchApplicationsService,
  type SearchTotals,
  type SearchTotalsOf,
} from '../applications/index.js';
import {
  type ActiveSearch,
  type ArchiveSearch,
  type CreateActiveSearch,
  type InTransaction,
  type SearchById,
  SearchesRepository,
  type SearchRow,
} from './searches.repository.js';
import { SearchesService } from './searches.service.js';

type StoredSearch = { userId: string; row: SearchRow };

type FakeData = { searches?: StoredSearch[]; totals?: Record<string, SearchTotals> };

const CURRENT_SEARCH_ID = '0199f0a0-0000-7000-8000-0000000000a3';

const ARCHIVED_ID = '0199f0a0-0000-7000-8000-0000000000a4';

const BOHDAN_SEARCH_ID = '0199f0a0-0000-7000-8000-0000000000a5';

const NO_TOTALS: SearchTotals = { applications: 0, interviews: 0, offers: 0, firstOfferAt: null };

const activeRow = (id: string): SearchRow => ({
  id,
  title: 'Мій пошук',
  status: 'active',
  outcome: null,
  startedAt: daysBefore(41),
  finishedAt: null,
});

const OLENA_ACTIVE: StoredSearch = { userId: OLENA_ID, row: activeRow(SEARCH_ID) };

const OLENA_ARCHIVED: StoredSearch = {
  userId: OLENA_ID,
  row: {
    id: ARCHIVED_ID,
    title: 'Перший пошук',
    status: 'archived',
    outcome: 'paused',
    startedAt: daysBefore(120),
    finishedAt: daysBefore(60),
  },
};

const BOHDAN_ACTIVE: StoredSearch = { userId: BOHDAN_ID, row: activeRow(BOHDAN_SEARCH_ID) };

const FINISH: FinishSearchInput = {
  searchId: SEARCH_ID,
  outcome: 'offer_accepted',
  openApplications: 'move',
};

class FakeSearchesRepository {
  readonly locks: ByUser<InTransaction>[] = [];

  readonly archived: ByUser<ArchiveSearch>[] = [];

  readonly created: ByUser<CreateActiveSearch>[] = [];

  constructor(private readonly searches: StoredSearch[]) {}

  lockActive(userId: string, inTransaction: InTransaction): Promise<ActiveSearch | null> {
    this.locks.push({ userId, ...inTransaction });
    const active = this.rowsOf(userId).find(({ status }) => status === 'active');
    return Promise.resolve(active ? { id: active.id } : null);
  }

  archive(userId: string, input: ArchiveSearch): Promise<SearchRow> {
    this.archived.push({ userId, ...input });
    const { outcome, finishedAt } = input;
    const row = this.rowsOf(userId).find(({ id }) => id === input.id);
    return row
      ? Promise.resolve({ ...row, status: 'archived', outcome, finishedAt })
      : Promise.reject(new Error(`No search ${input.id} to archive`));
  }

  createActive(userId: string, input: CreateActiveSearch): Promise<SearchRow> {
    this.created.push({ userId, ...input });
    return Promise.resolve({ ...activeRow(CURRENT_SEARCH_ID), startedAt: input.startedAt });
  }

  findAll(userId: string): Promise<SearchRow[]> {
    return Promise.resolve(this.rowsOf(userId));
  }

  exists(userId: string, { id }: SearchById): Promise<boolean> {
    return Promise.resolve(this.rowsOf(userId).some((row) => row.id === id));
  }

  private rowsOf(userId: string): SearchRow[] {
    return this.searches.filter((search) => search.userId === userId).map(({ row }) => row);
  }
}

class FakeSearchApplications {
  readonly handOvers: ByUser<HandOver>[] = [];

  readonly totalsQueries: ByUser<{ searchIds: readonly string[] }>[] = [];

  constructor(private readonly totals: Record<string, SearchTotals>) {}

  handOver(userId: string, handOver: HandOver): Promise<void> {
    this.handOvers.push({ userId, ...handOver });
    return Promise.resolve();
  }

  totalsOf(userId: string, searchIds: readonly string[]): Promise<SearchTotalsOf> {
    this.totalsQueries.push({ userId, searchIds });
    return Promise.resolve((searchId) => this.totals[searchId] ?? NO_TOTALS);
  }
}

async function serviceWith({
  searches = [OLENA_ACTIVE, OLENA_ARCHIVED, BOHDAN_ACTIVE],
  totals = {},
}: FakeData = {}) {
  const repository = new FakeSearchesRepository(searches);
  const searchApplications = new FakeSearchApplications(totals);
  const moduleRef = await fakeTransactionModule({
    providers: [SearchesService, SearchesRepository, SearchApplicationsService],
    now: NOW,
  })
    .overrideProvider(SearchesRepository)
    .useValue(repository)
    .overrideProvider(SearchApplicationsService)
    .useValue(searchApplications)
    .compile();
  return { repository, searchApplications, service: moduleRef.get(SearchesService) };
}

describe('SearchesService.finish', () => {
  it('archives the active search with the outcome at the clock time, starts a new active search then and hands the open applications over, all in one transaction', async () => {
    const { repository, searchApplications, service } = await serviceWith();

    await service.finish(OLENA_ID, FINISH);

    expect(repository.locks).toEqual([{ userId: OLENA_ID, tx: FAKE_TRANSACTION }]);
    expect(repository.archived).toEqual([
      {
        userId: OLENA_ID,
        id: SEARCH_ID,
        outcome: 'offer_accepted',
        finishedAt: NOW,
        tx: FAKE_TRANSACTION,
      },
    ]);
    expect(repository.created).toEqual([
      { userId: OLENA_ID, startedAt: NOW, tx: FAKE_TRANSACTION },
    ]);
    expect(searchApplications.handOvers).toEqual([
      {
        userId: OLENA_ID,
        fromSearchId: SEARCH_ID,
        toSearchId: CURRENT_SEARCH_ID,
        choice: 'move',
        now: NOW,
        tx: FAKE_TRANSACTION,
      },
    ]);
  });

  it('answers the finished and the new search with their totals, the days from start to finish and the days to the first offer', async () => {
    const { searchApplications, service } = await serviceWith({
      totals: {
        [SEARCH_ID]: { applications: 54, interviews: 9, offers: 1, firstOfferAt: daysBefore(3) },
      },
    });

    const response = await service.finish(OLENA_ID, { ...FINISH, openApplications: 'withdraw' });

    expect(response).toEqual({
      finished: {
        id: SEARCH_ID,
        title: 'Мій пошук',
        status: 'archived',
        outcome: 'offer_accepted',
        startedAt: '2026-09-11T09:00:00.000Z',
        finishedAt: '2026-10-22T09:00:00.000Z',
        days: 41,
        applications: 54,
        interviews: 9,
        offers: 1,
        daysToOffer: 38,
      },
      current: {
        id: CURRENT_SEARCH_ID,
        title: 'Мій пошук',
        status: 'active',
        outcome: null,
        startedAt: '2026-10-22T09:00:00.000Z',
        finishedAt: null,
        days: 0,
        applications: 0,
        interviews: 0,
        offers: 0,
        daysToOffer: null,
      },
    });
    expect(searchApplications.totalsQueries).toEqual([
      { userId: OLENA_ID, searchIds: [SEARCH_ID, CURRENT_SEARCH_ID] },
    ]);
  });

  it.each([
    {
      case: 'no active search',
      searches: [OLENA_ARCHIVED, BOHDAN_ACTIVE],
      searchId: ARCHIVED_ID,
      error: { status: 409, type: 'conflict', detail: 'No active search' },
    },
    {
      case: 'her already finished search',
      searches: undefined,
      searchId: ARCHIVED_ID,
      error: { status: 409, type: 'conflict', detail: 'The search is already finished' },
    },
    {
      case: "BOHDAN's active search",
      searches: undefined,
      searchId: BOHDAN_SEARCH_ID,
      error: { status: 404, type: 'not_found', detail: 'Search not found' },
    },
    {
      case: 'a missing search',
      searches: undefined,
      searchId: MISSING_ID,
      error: { status: 404, type: 'not_found', detail: 'Search not found' },
    },
  ])(
    'answers $case with $error.status and archives, starts and hands over nothing',
    async ({ searches, searchId, error }) => {
      const { repository, searchApplications, service } = await serviceWith(
        searches ? { searches } : {},
      );

      await expect(service.finish(OLENA_ID, { ...FINISH, searchId })).rejects.toMatchObject({
        body: error,
      });
      expect([repository.archived, repository.created, searchApplications.handOvers]).toEqual([
        [],
        [],
        [],
      ]);
    },
  );
});

describe('SearchesService.list', () => {
  it('lists her searches as read with their totals, giving the active search its days until now and no daysToOffer without an offer', async () => {
    const { searchApplications, service } = await serviceWith({
      totals: {
        [SEARCH_ID]: { applications: 12, interviews: 2, offers: 0, firstOfferAt: null },
        [ARCHIVED_ID]: {
          applications: 54,
          interviews: 9,
          offers: 1,
          firstOfferAt: daysBefore(100),
        },
      },
    });

    const response = await service.list(OLENA_ID);

    expect(response).toEqual({
      items: [
        {
          id: SEARCH_ID,
          title: 'Мій пошук',
          status: 'active',
          outcome: null,
          startedAt: '2026-09-11T09:00:00.000Z',
          finishedAt: null,
          days: 41,
          applications: 12,
          interviews: 2,
          offers: 0,
          daysToOffer: null,
        },
        {
          id: ARCHIVED_ID,
          title: 'Перший пошук',
          status: 'archived',
          outcome: 'paused',
          startedAt: '2026-06-24T09:00:00.000Z',
          finishedAt: '2026-08-23T09:00:00.000Z',
          days: 60,
          applications: 54,
          interviews: 9,
          offers: 1,
          daysToOffer: 20,
        },
      ],
    });
    expect(searchApplications.totalsQueries).toEqual([
      { userId: OLENA_ID, searchIds: [SEARCH_ID, ARCHIVED_ID] },
    ]);
  });
});
