import type { ImportRowInput } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import type { ByUser } from '../../test/recorded-events.js';
import { OLENA_ID, SEARCH_ID } from '../../test/service-fixtures.js';
import { daysBefore, NOW } from '../../test/time.js';
import { ApplicationImportService } from './application-import.service.js';
import {
  ApplicationsRepository,
  type CreateDefaults,
  type InsertApplications,
  type RecordApplicationEvents,
} from './applications.repository.js';

const APPLIED_AT = daysBefore(10).toISOString();

const SCREENED_AT = daysBefore(8).toISOString();

const GHOSTED_AT = daysBefore(5).toISOString();

const VELA: ImportRowInput = {
  company: 'Vela',
  position: 'Frontend Engineer',
  appliedAt: APPLIED_AT,
};

const imported = (index: number) => `0199f0a0-0000-7000-8000-00000000090${String(index)}`;

class FakeApplicationsRepository {
  readonly inserted: ByUser<InsertApplications>[] = [];

  readonly recorded: ByUser<RecordApplicationEvents>[] = [];

  constructor(private readonly defaults: CreateDefaults) {}

  findCreateDefaults(): Promise<CreateDefaults> {
    return Promise.resolve(this.defaults);
  }

  insertMany(userId: string, input: InsertApplications): Promise<string[]> {
    this.inserted.push({ userId, ...input });
    return Promise.resolve(input.applications.map((_, index) => imported(index)));
  }

  recordEvents(userId: string, input: RecordApplicationEvents): Promise<void> {
    this.recorded.push({ userId, ...input });
    return Promise.resolve();
  }
}

async function importWith(searchId: string | null = SEARCH_ID) {
  const repository = new FakeApplicationsRepository({ searchId, resumeVersionId: null });
  const moduleRef = await fakeTransactionModule({
    providers: [
      ApplicationImportService,
      { provide: ApplicationsRepository, useValue: repository },
    ],
    now: NOW,
  }).compile();
  return { service: moduleRef.get(ApplicationImportService), repository };
}

const historyOf = (...moves: [string, string, string | null][]) =>
  moves.map(([toStage, occurredAt, reasonCode]) => ({ toStage, occurredAt, reasonCode }));

const eventsOf = ({ repository }: Awaited<ReturnType<typeof importWith>>) =>
  repository.inserted.flatMap(({ applications }) =>
    applications.map(({ events }) =>
      events.map(({ fromStage, toStage, reasonCode, occurredAt }) => [
        fromStage,
        toStage,
        reasonCode,
        occurredAt.toISOString(),
      ]),
    ),
  );

describe('ApplicationImportService.importRows', () => {
  it('imports a row without history at final through applied and screening at its applied date, with one application.created', async () => {
    const fakes = await importWith();

    const result = await fakes.service.importRows(OLENA_ID, {
      rows: [{ ...VELA, stage: 'final', source: 'djinni', salaryMin: 1500, currency: 'USD' }],
    });

    expect(result).toEqual({ imported: 1, errors: [] });
    expect(eventsOf(fakes)).toEqual([
      [
        [null, 'applied', null, APPLIED_AT],
        ['applied', 'screening', null, APPLIED_AT],
        ['screening', 'final', null, APPLIED_AT],
      ],
    ]);
    expect(fakes.repository.inserted[0]).toMatchObject({
      userId: OLENA_ID,
      searchId: SEARCH_ID,
      tx: FAKE_TRANSACTION,
      applications: [
        {
          fields: {
            company: 'Vela',
            position: 'Frontend Engineer',
            source: 'djinni',
            salaryMin: 1500,
            currency: 'USD',
          },
          currentStage: 'final',
          appliedAt: new Date(APPLIED_AT),
          lastEventAt: new Date(APPLIED_AT),
        },
      ],
    });
    expect(fakes.repository.recorded).toEqual([
      {
        userId: OLENA_ID,
        events: [{ eventType: 'application.created', applicationId: imported(0) }],
        tx: FAKE_TRANSACTION,
      },
    ]);
  });

  it.each([
    { stage: 'applied', path: [[null, 'applied', null]] },
    {
      stage: 'offer',
      path: [
        [null, 'applied', null],
        ['applied', 'screening', null],
        ['screening', 'offer', null],
      ],
    },
    {
      stage: 'rejected',
      path: [
        [null, 'applied', null],
        ['applied', 'rejected', 'unspecified'],
      ],
    },
  ])('gives a row at $stage without history the shortest allowed path', async ({ stage, path }) => {
    const fakes = await importWith();

    await fakes.service.importRows(OLENA_ID, { rows: [{ ...VELA, stage }] });

    expect(eventsOf(fakes)).toEqual([path.map((step) => [...step, APPLIED_AT])]);
  });

  it('replays a history with a rejection after screening exactly and takes its stage and last date from it', async () => {
    const fakes = await importWith();

    await fakes.service.importRows(OLENA_ID, {
      rows: [
        {
          ...VELA,
          stage: 'applied',
          stageHistory: historyOf(
            ['applied', APPLIED_AT, null],
            ['screening', SCREENED_AT, null],
            ['rejected', GHOSTED_AT, 'skills_gap'],
          ),
        },
      ],
    });

    expect(eventsOf(fakes)).toEqual([
      [
        [null, 'applied', null, APPLIED_AT],
        ['applied', 'screening', null, SCREENED_AT],
        ['screening', 'rejected', 'skills_gap', GHOSTED_AT],
      ],
    ]);
    expect(fakes.repository.inserted[0]?.applications[0]).toMatchObject({
      currentStage: 'rejected',
      lastEventAt: new Date(GHOSTED_AT),
    });
  });

  it('revives a ghosted history to the stage before it', async () => {
    const fakes = await importWith();

    const result = await fakes.service.importRows(OLENA_ID, {
      rows: [
        {
          ...VELA,
          stageHistory: historyOf(
            ['applied', APPLIED_AT, null],
            ['screening', SCREENED_AT, null],
            ['ghosted', GHOSTED_AT, null],
            ['screening', NOW.toISOString(), null],
          ),
        },
      ],
    });

    expect(result).toEqual({ imported: 1, errors: [] });
    expect(fakes.repository.inserted[0]?.applications[0]?.currentStage).toBe('screening');
  });

  it('reports the rows it refuses by index and path and imports the valid ones', async () => {
    const fakes = await importWith();

    const result = await fakes.service.importRows(OLENA_ID, {
      rows: [
        { position: 'QA', appliedAt: APPLIED_AT },
        VELA,
        {
          ...VELA,
          stageHistory: historyOf(['applied', APPLIED_AT, null], ['offer', SCREENED_AT, null]),
        },
        {
          ...VELA,
          stageHistory: historyOf(
            ['applied', APPLIED_AT, null],
            ['screening', SCREENED_AT, null],
            ['ghosted', GHOSTED_AT, null],
            ['tech_interview', NOW.toISOString(), null],
          ),
        },
        'not a row',
      ],
    });

    expect(result.imported).toBe(1);
    expect(result.errors.map(({ row, path }) => [row, path])).toEqual([
      [0, 'company'],
      [2, 'stageHistory.1.toStage'],
      [3, 'stageHistory.3.toStage'],
      [4, ''],
    ]);
    expect(result.errors[1]?.message).toBe('applied -> offer: not_allowed');
    expect(fakes.repository.inserted[0]?.applications.map(({ fields }) => fields.company)).toEqual([
      'Vela',
    ]);
  });

  it('answers 409 without an active search and writes nothing', async () => {
    const fakes = await importWith(null);

    await expect(fakes.service.importRows(OLENA_ID, { rows: [VELA] })).rejects.toMatchObject({
      status: 409,
    });
    expect([fakes.repository.inserted, fakes.repository.recorded]).toEqual([[], []]);
  });
});
