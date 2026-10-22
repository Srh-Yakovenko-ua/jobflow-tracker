import type { ApplicationResponse, CreateApplicationInput } from '@jobflow/shared';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FAKE_TRANSACTION, FakePrisma } from '../../test/fake-prisma.js';
import {
  type ApplicationById,
  type ApplicationRow,
  ApplicationsRepository,
  type CreateDefaults,
  type InsertApplication,
  type RecordApplicationEvent,
  type SoftDeleteApplication,
  type UpdateApplicationById,
} from './applications.repository.js';
import { ApplicationsService } from './applications.service.js';

type ByUser<T> = T & { userId: string };

type OwnedRow = { userId: string; row: ApplicationRow };

type FakeData = { owned?: OwnedRow[]; defaults?: CreateDefaults };

type Target = { userId: string; id: string };

const NOW = new Date('2026-10-22T09:00:00.000Z');

const DAY_MS = 24 * 60 * 60 * 1000;

const daysBefore = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

const OLENA_ID = '0199f0a0-0000-7000-8000-000000000001';
const BOHDAN_ID = '0199f0a0-0000-7000-8000-000000000002';
const SEARCH_ID = '0199f0a0-0000-7000-8000-0000000000a1';
const RESUME_VERSION_ID = '0199f0a0-0000-7000-8000-0000000000b1';
const APPLICATION_ID = '0199f0a0-0000-7000-8000-0000000000c1';
const MISSING_ID = '0199f0a0-0000-7000-8000-0000000000c2';

const ACTIVE_DEFAULTS: CreateDefaults = { searchId: SEARCH_ID, resumeVersionId: RESUME_VERSION_ID };

const COLUMNS_AS_STORED = {
  id: APPLICATION_ID,
  searchId: SEARCH_ID,
  company: 'Ромашка',
  position: 'Backend developer',
  url: 'https://jobs.example.test/1',
  source: 'djinni',
  salaryMin: 3000,
  salaryMax: 4000,
  currency: 'USD',
  stack: ['NestJS'],
  location: 'Київ',
  workMode: 'remote',
  currentStage: 'applied',
  isDraft: false,
  resumeVersionId: RESUME_VERSION_ID,
  matchScore: null,
  rawText: null,
} satisfies Partial<ApplicationRow & ApplicationResponse>;

const ROW: ApplicationRow = {
  ...COLUMNS_AS_STORED,
  aiParsed: { seniority: 'middle' },
  appliedAt: daysBefore(10),
  lastEventAt: daysBefore(4),
  createdAt: daysBefore(10),
  updatedAt: daysBefore(1),
  stageEvents: [{ occurredAt: daysBefore(10) }],
  user: { settings: { silenceDays: 7 } },
};

const OLENAS_ROW: OwnedRow = { userId: OLENA_ID, row: ROW };

const NOT_FOUND = { body: { status: 404, type: 'not_found', detail: 'Application not found' } };

class FakeApplicationsRepository {
  readonly inserted: ByUser<InsertApplication>[] = [];
  readonly events: ByUser<RecordApplicationEvent>[] = [];
  readonly updates: ByUser<UpdateApplicationById>[] = [];
  readonly deletions: ByUser<SoftDeleteApplication>[] = [];

  constructor(private readonly data: Required<FakeData>) {}

  findCreateDefaults(): Promise<CreateDefaults> {
    return Promise.resolve(this.data.defaults);
  }

  insert(userId: string, input: InsertApplication): Promise<ApplicationRow> {
    this.inserted.push({ userId, ...input });
    return Promise.resolve(ROW);
  }

  recordEvent(userId: string, input: RecordApplicationEvent): Promise<void> {
    this.events.push({ userId, ...input });
    return Promise.resolve();
  }

  findOwned(userId: string, { id }: ApplicationById): Promise<ApplicationRow | null> {
    return Promise.resolve(this.ownedRow({ userId, id }) ?? null);
  }

  updateOwned(userId: string, input: UpdateApplicationById): Promise<number> {
    this.updates.push({ userId, ...input });
    return Promise.resolve(this.ownedRow({ userId, id: input.id }) === undefined ? 0 : 1);
  }

  softDelete(userId: string, input: SoftDeleteApplication): Promise<number> {
    this.deletions.push({ userId, ...input });
    return Promise.resolve(this.ownedRow({ userId, id: input.id }) === undefined ? 0 : 1);
  }

  private ownedRow({ userId, id }: Target): ApplicationRow | undefined {
    return this.data.owned.find((owned) => owned.userId === userId && owned.row.id === id)?.row;
  }
}

async function serviceWith({ owned = [OLENAS_ROW], defaults = ACTIVE_DEFAULTS }: FakeData = {}) {
  const repository = new FakeApplicationsRepository({ owned, defaults });
  const moduleRef = await Test.createTestingModule({
    providers: [ApplicationsService, ApplicationsRepository, PrismaService, Clock],
  })
    .overrideProvider(ApplicationsRepository)
    .useValue(repository)
    .overrideProvider(PrismaService)
    .useValue(new FakePrisma())
    .overrideProvider(Clock)
    .useValue({ now: () => NOW })
    .compile();
  return { repository, service: moduleRef.get(ApplicationsService) };
}

const OWNER_ONLY_CALLS = [
  {
    method: 'get',
    call: (service: ApplicationsService, { userId, id }: Target) => service.get(userId, id),
  },
  {
    method: 'update',
    call: (service: ApplicationsService, { userId, id }: Target) =>
      service.update(userId, { id, input: { company: 'Нова назва' } }),
  },
  {
    method: 'remove',
    call: (service: ApplicationsService, { userId, id }: Target) => service.remove(userId, id),
  },
];

const MISSING_TARGETS = [
  { case: 'a missing id', userId: OLENA_ID, id: MISSING_ID },
  { case: "another user's application", userId: BOHDAN_ID, id: APPLICATION_ID },
];

describe('ApplicationsService.create', () => {
  const input: CreateApplicationInput = {
    company: 'Ромашка',
    position: 'Backend developer',
    source: 'other',
    stack: [],
  };

  it('inserts the application in applied with its first event null to applied and the active resume version', async () => {
    const { repository, service } = await serviceWith();

    await service.create(OLENA_ID, input);

    expect(repository.inserted).toEqual([
      {
        userId: OLENA_ID,
        application: {
          ...input,
          searchId: SEARCH_ID,
          resumeVersionId: RESUME_VERSION_ID,
          currentStage: 'applied',
          appliedAt: NOW,
          lastEventAt: NOW,
        },
        firstEvent: { fromStage: null, toStage: 'applied', occurredAt: NOW },
        tx: FAKE_TRANSACTION,
      },
    ]);
  });

  it('records application.created in the same transaction as the insert', async () => {
    const { repository, service } = await serviceWith();

    await service.create(OLENA_ID, input);

    expect(repository.events).toEqual([
      {
        userId: OLENA_ID,
        event: { eventType: 'application.created', applicationId: APPLICATION_ID },
        tx: FAKE_TRANSACTION,
      },
    ]);
  });

  it('refuses a user without an active search with 409 and writes nothing', async () => {
    const { repository, service } = await serviceWith({
      defaults: { searchId: null, resumeVersionId: null },
    });

    await expect(service.create(OLENA_ID, input)).rejects.toMatchObject({
      body: { status: 409, type: 'conflict', detail: 'No active search' },
    });
    expect([repository.inserted, repository.events]).toEqual([[], []]);
  });
});

describe.each(OWNER_ONLY_CALLS)('ApplicationsService.$method', ({ call }) => {
  it.each(MISSING_TARGETS)('answers $case with 404 and records no event', async (target) => {
    const { repository, service } = await serviceWith();

    await expect(call(service, target)).rejects.toMatchObject(NOT_FOUND);
    expect(repository.events).toEqual([]);
  });
});

describe('ApplicationsService.update', () => {
  it('writes only the sent fields and records them as the changed fields of application.updated', async () => {
    const { repository, service } = await serviceWith();
    const input = { company: 'Ромашка Плюс', salaryMin: 4700, salaryMax: 5900 };

    await service.update(OLENA_ID, { id: APPLICATION_ID, input });

    expect(repository.updates).toEqual([
      { userId: OLENA_ID, id: APPLICATION_ID, data: input, tx: FAKE_TRANSACTION },
    ]);
    expect(repository.events).toEqual([
      {
        userId: OLENA_ID,
        event: {
          eventType: 'application.updated',
          applicationId: APPLICATION_ID,
          fields: ['company', 'salaryMin', 'salaryMax'],
        },
        tx: FAKE_TRANSACTION,
      },
    ]);
  });
});

describe('ApplicationsService.remove', () => {
  it('soft deletes at the clock time and records application.updated with deletedAt', async () => {
    const { repository, service } = await serviceWith();

    await service.remove(OLENA_ID, APPLICATION_ID);

    expect(repository.deletions).toEqual([
      { userId: OLENA_ID, id: APPLICATION_ID, deletedAt: NOW, tx: FAKE_TRANSACTION },
    ]);
    expect(repository.events).toEqual([
      {
        userId: OLENA_ID,
        event: {
          eventType: 'application.updated',
          applicationId: APPLICATION_ID,
          fields: ['deletedAt'],
        },
        tx: FAKE_TRANSACTION,
      },
    ]);
  });
});

describe('the application response', () => {
  it('carries ISO dates, the parsed aiParsed and the computed fields, and no owner columns', async () => {
    const { service } = await serviceWith();

    const response = await service.get(OLENA_ID, APPLICATION_ID);

    expect(response).toEqual({
      ...COLUMNS_AS_STORED,
      aiParsed: { seniority: 'middle' },
      appliedAt: '2026-10-12T09:00:00.000Z',
      lastEventAt: '2026-10-18T09:00:00.000Z',
      createdAt: '2026-10-12T09:00:00.000Z',
      updatedAt: '2026-10-21T09:00:00.000Z',
      daysInStage: 10,
      daysSinceLastEvent: 4,
      silenceLevel: 'warn',
    } satisfies ApplicationResponse);
  });

  it.each<{ case: string; row: Partial<ApplicationRow>; expected: Partial<ApplicationResponse> }>([
    {
      case: 'createdAt when no stage event exists and 7 silence days without settings',
      row: {
        stageEvents: [],
        createdAt: daysBefore(3),
        lastEventAt: daysBefore(7),
        user: { settings: null },
      },
      expected: { daysInStage: 3, daysSinceLastEvent: 7, silenceLevel: 'silent' },
    },
    {
      case: "the owner's silenceDays",
      row: { lastEventAt: daysBefore(3), user: { settings: { silenceDays: 3 } } },
      expected: { daysInStage: 10, daysSinceLastEvent: 3, silenceLevel: 'silent' },
    },
    {
      case: 'the doubled threshold on final',
      row: {
        currentStage: 'final',
        stageEvents: [{ occurredAt: daysBefore(20) }],
        lastEventAt: daysBefore(13),
      },
      expected: { daysInStage: 20, daysSinceLastEvent: 13, silenceLevel: 'warn' },
    },
    {
      case: 'no silence outside the active stages',
      row: { currentStage: 'offer', lastEventAt: daysBefore(30) },
      expected: { daysInStage: 10, daysSinceLastEvent: 30, silenceLevel: 'none' },
    },
  ])('counts the days and the silence level from $case', async ({ row, expected }) => {
    const { service } = await serviceWith({
      owned: [{ userId: OLENA_ID, row: { ...ROW, ...row } }],
    });

    const response = await service.get(OLENA_ID, APPLICATION_ID);

    expect(response).toMatchObject(expected);
  });
});
