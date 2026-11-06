import type { OpenApplicationChoice } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { PrismaService } from '../../prisma/prisma.service.js';
import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import type { ByUser } from '../../test/recorded-events.js';
import { APPLICATION_ID, OLENA_ID, SEARCH_ID } from '../../test/service-fixtures.js';
import { daysBefore, NOW } from '../../test/time.js';
import { ApplicationsRepository, type RecordApplicationEvents } from './applications.repository.js';
import {
  type OpenApplication,
  type OpenInSearch,
  SearchApplicationsRepository,
  type SearchMove,
  type SearchTotalsRow,
  type Withdrawal,
} from './search-applications.repository.js';
import { SearchApplicationsService } from './search-applications.service.js';

type Write = ByUser<{ method: string; input: object }>;

type FakeData = { open?: OpenApplication[]; totals?: SearchTotalsRow[] };

const CURRENT_SEARCH_ID = '0199f0a0-0000-7000-8000-0000000000a3';

const FINAL_ID = '0199f0a0-0000-7000-8000-0000000000c3';

const OPEN: OpenApplication[] = [
  { id: APPLICATION_ID, currentStage: 'screening' },
  { id: FINAL_ID, currentStage: 'final' },
];

const withdrawalAt = ({ id, currentStage }: OpenApplication) => ({
  applicationId: id,
  fromStage: currentStage,
  toStage: 'withdrawn',
  reasonCode: null,
  comment: null,
  occurredAt: NOW,
  compensatesEventId: null,
  createdAt: NOW,
});

const stageChangedOf = ({ id, currentStage }: OpenApplication) => ({
  eventType: 'application.stage_changed',
  applicationId: id,
  fromStage: currentStage,
  toStage: 'withdrawn',
  reasonCode: null,
  compensatesEventId: null,
});

class FakeSearchApplicationsRepository {
  readonly locks: ByUser<OpenInSearch>[] = [];

  readonly writes: Write[] = [];

  readonly totalsQueries: ByUser<{ searchIds: readonly string[] }>[] = [];

  missedRows = 0;

  constructor(private readonly data: Required<FakeData>) {}

  lockOpen(userId: string, query: OpenInSearch): Promise<OpenApplication[]> {
    this.locks.push({ userId, ...query });
    return Promise.resolve(this.data.open);
  }

  withdraw(userId: string, input: Withdrawal): Promise<number> {
    this.writes.push({ userId, method: 'withdraw', input });
    return Promise.resolve(input.events.length - this.missedRows);
  }

  moveTo(userId: string, input: SearchMove): Promise<number> {
    this.writes.push({ userId, method: 'moveTo', input });
    return Promise.resolve(input.ids.length - this.missedRows);
  }

  totalsOf(userId: string, searchIds: readonly string[]): Promise<SearchTotalsRow[]> {
    this.totalsQueries.push({ userId, searchIds });
    return Promise.resolve(this.data.totals);
  }
}

class FakeApplicationsRepository {
  constructor(private readonly writes: Write[]) {}

  recordEvents(userId: string, input: RecordApplicationEvents): Promise<void> {
    this.writes.push({ userId, method: 'recordEvents', input });
    return Promise.resolve();
  }
}

async function serviceWith({ open = OPEN, totals = [] }: FakeData = {}) {
  const repository = new FakeSearchApplicationsRepository({ open, totals });
  const moduleRef = await fakeTransactionModule({
    providers: [SearchApplicationsService, SearchApplicationsRepository, ApplicationsRepository],
    now: NOW,
  })
    .overrideProvider(SearchApplicationsRepository)
    .useValue(repository)
    .overrideProvider(ApplicationsRepository)
    .useValue(new FakeApplicationsRepository(repository.writes))
    .compile();
  const service = moduleRef.get(SearchApplicationsService);
  const prisma = moduleRef.get(PrismaService);
  const handOver = (choice: OpenApplicationChoice) =>
    prisma.$transaction((tx) =>
      service.handOver(OLENA_ID, {
        fromSearchId: SEARCH_ID,
        toSearchId: CURRENT_SEARCH_ID,
        choice,
        now: NOW,
        tx,
      }),
    );
  return { repository, service, handOver };
}

describe('SearchApplicationsService.handOver', () => {
  it("locks the open applications of the finished search in the caller's transaction", async () => {
    const { repository, handOver } = await serviceWith();

    await handOver('move');

    expect(repository.locks).toEqual([
      { userId: OLENA_ID, searchId: SEARCH_ID, tx: FAKE_TRANSACTION },
    ]);
  });

  it('withdraws every open application with one withdrawn stage event from its stage at the clock time, the guarded projection and one stage_changed event each', async () => {
    const { repository, handOver } = await serviceWith();

    await handOver('withdraw');

    expect(repository.writes).toEqual([
      {
        userId: OLENA_ID,
        method: 'withdraw',
        input: { events: OPEN.map(withdrawalAt), lastEventAt: NOW, tx: FAKE_TRANSACTION },
      },
      {
        userId: OLENA_ID,
        method: 'recordEvents',
        input: { events: OPEN.map(stageChangedOf), tx: FAKE_TRANSACTION },
      },
    ]);
  });

  it('moves every open application into the new search with one application.updated of searchId each and writes no stage event', async () => {
    const { repository, handOver } = await serviceWith();

    await handOver('move');

    expect(repository.writes).toEqual([
      {
        userId: OLENA_ID,
        method: 'moveTo',
        input: {
          ids: [APPLICATION_ID, FINAL_ID],
          fromSearchId: SEARCH_ID,
          toSearchId: CURRENT_SEARCH_ID,
          tx: FAKE_TRANSACTION,
        },
      },
      {
        userId: OLENA_ID,
        method: 'recordEvents',
        input: {
          events: [
            {
              eventType: 'application.updated',
              applicationId: APPLICATION_ID,
              fields: ['searchId'],
            },
            { eventType: 'application.updated', applicationId: FINAL_ID, fields: ['searchId'] },
          ],
          tx: FAKE_TRANSACTION,
        },
      },
    ]);
  });

  it('refuses to withdraw a locked application whose stage cannot go to withdrawn and writes nothing', async () => {
    const { repository, handOver } = await serviceWith({
      open: [...OPEN, { id: '0199f0a0-0000-7000-8000-0000000000c4', currentStage: 'rejected' }],
    });

    await expect(handOver('withdraw')).rejects.toMatchObject({
      body: {
        status: 409,
        type: 'illegal_transition',
        detail: 'rejected -> withdrawn: terminal_stage',
      },
    });
    expect(repository.writes).toEqual([]);
  });

  it.each([
    { choice: 'move', write: 'moveTo' },
    { choice: 'withdraw', write: 'withdraw' },
  ] as const)(
    'answers 409 and records no event when the guarded $write misses an open application',
    async ({ choice, write }) => {
      const { repository, handOver } = await serviceWith();
      repository.missedRows = 1;

      await expect(handOver(choice)).rejects.toMatchObject({
        body: { status: 409, type: 'conflict' },
      });
      expect(repository.writes.map(({ method }) => method)).toEqual([write]);
    },
  );
});

describe('SearchApplicationsService.totalsOf', () => {
  it("gives each of the user's searches its totals as read, and zero totals to a search without applications", async () => {
    const { repository, service } = await serviceWith({
      totals: [
        {
          searchId: SEARCH_ID,
          applications: 4,
          interviews: 3,
          offers: 1,
          firstOfferAt: daysBefore(3),
        },
      ],
    });

    const totalsOf = await service.totalsOf(OLENA_ID, [SEARCH_ID, CURRENT_SEARCH_ID]);

    expect([totalsOf(SEARCH_ID), totalsOf(CURRENT_SEARCH_ID)]).toEqual([
      { applications: 4, interviews: 3, offers: 1, firstOfferAt: daysBefore(3) },
      { applications: 0, interviews: 0, offers: 0, firstOfferAt: null },
    ]);
    expect(repository.totalsQueries).toEqual([
      { userId: OLENA_ID, searchIds: [SEARCH_ID, CURRENT_SEARCH_ID] },
    ]);
  });
});
