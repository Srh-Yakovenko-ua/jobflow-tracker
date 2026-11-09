import type { PossibleDuplicate } from '@jobflow/shared';
import { buildVacancyParseOutput, vacancyFieldOf } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AI_JOB_ID, PARSED_VACANCY_COLUMNS, VACANCY_TEXT } from '../../test/ai.js';
import { POSSIBLE_DUPLICATE } from '../../test/capture.js';
import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import { type ByUser, RecordedEvents } from '../../test/recorded-events.js';
import {
  APPLICATION_ID,
  APPLICATION_ROW,
  BOHDAN_ID,
  MISSING_ID,
  OLENA_ID,
} from '../../test/service-fixtures.js';
import { minutesBefore, NOW } from '../../test/time.js';
import { ApplicationDraftsService } from './application-drafts.service.js';
import type { DuplicateProbe } from './application-duplicates.repository.js';
import {
  type ApplicationById,
  type ApplicationRow,
  ApplicationsRepository,
  type FillDraft,
  type RecordApplicationEvent,
} from './applications.repository.js';
import { ApplicationsService, type InsertApplied } from './applications.service.js';

const tx = FAKE_TRANSACTION;

const DRAFT_ROW: ApplicationRow = {
  ...APPLICATION_ROW,
  isDraft: true,
  aiParsed: null,
  rawText: VACANCY_TEXT,
  createdAt: minutesBefore(2),
};

const OUTPUT = buildVacancyParseOutput();

const FILL = { applicationId: APPLICATION_ID, output: OUTPUT };

const FILLED_FIELDS = [
  'company',
  'position',
  'salaryMin',
  'salaryMax',
  'currency',
  'stack',
  'location',
  'workMode',
  'aiParsed',
];

class FakeApplications {
  readonly inserted: ByUser<InsertApplied>[] = [];
  readonly probes: ByUser<DuplicateProbe>[] = [];

  insertApplied(userId: string, input: InsertApplied): Promise<ApplicationRow> {
    this.inserted.push({ userId, ...input });
    return Promise.resolve(DRAFT_ROW);
  }

  possibleDuplicates(userId: string, probe: DuplicateProbe): Promise<PossibleDuplicate[]> {
    this.probes.push({ userId, ...probe });
    return Promise.resolve([POSSIBLE_DUPLICATE]);
  }
}

class FakeDraftsRepository extends RecordedEvents<RecordApplicationEvent> {
  readonly fills: ByUser<FillDraft>[] = [];

  constructor(private readonly row: ApplicationRow) {
    super();
  }

  findOwned(userId: string, { id }: ApplicationById): Promise<ApplicationRow | null> {
    return Promise.resolve(userId === OLENA_ID && id === this.row.id ? this.row : null);
  }

  async fillDraft(userId: string, input: FillDraft): Promise<Date | null> {
    this.fills.push({ userId, ...input });
    const row = await this.findOwned(userId, input);
    return row?.isDraft === true && row.aiParsed === null ? row.createdAt : null;
  }
}

async function serviceWith(row = DRAFT_ROW) {
  const applications = new FakeApplications();
  const repository = new FakeDraftsRepository(row);
  const moduleRef = await fakeTransactionModule({
    providers: [ApplicationDraftsService, ApplicationsRepository, ApplicationsService],
    now: NOW,
  })
    .overrideProvider(ApplicationsRepository)
    .useValue(repository)
    .overrideProvider(ApplicationsService)
    .useValue(applications)
    .compile();
  const service = moduleRef.get(ApplicationDraftsService);
  const within = <Result>(work: (client: Prisma.TransactionClient) => Promise<Result>) =>
    moduleRef.get(PrismaService).$transaction(work);
  return { applications, repository, service, within };
}

describe('ApplicationDraftsService.open', () => {
  it('inserts a draft under the placeholders with the pasted text and url', async () => {
    const { applications, service, within } = await serviceWith();
    const input = { text: VACANCY_TEXT, url: 'https://jobs.example.test/7' };

    await expect(
      within((client) => service.open(OLENA_ID, { input, tx: client })),
    ).resolves.toEqual({
      applicationId: APPLICATION_ID,
      createdAt: minutesBefore(2),
    });

    expect(applications.inserted).toEqual([
      {
        userId: OLENA_ID,
        fields: {
          company: 'компанію не розпізнано',
          position: 'Без назви',
          source: 'other',
          stack: [],
          url: 'https://jobs.example.test/7',
          isDraft: true,
          rawText: VACANCY_TEXT,
        },
        now: NOW,
        tx,
      },
    ]);
  });

  it('stores no url when the paste carries none', async () => {
    const { applications, service, within } = await serviceWith();

    await within((client) => service.open(OLENA_ID, { input: { text: VACANCY_TEXT }, tx: client }));

    expect(applications.inserted.map(({ fields }) => fields.url)).toEqual([null]);
  });
});

describe('ApplicationDraftsService.possibleDuplicates', () => {
  it('looks for duplicates by the pasted url alone', async () => {
    const { applications, service } = await serviceWith();
    const url = 'https://jobs.example.test/7';

    await expect(service.possibleDuplicates(OLENA_ID, { url })).resolves.toEqual([
      POSSIBLE_DUPLICATE,
    ]);

    expect(applications.probes).toEqual([{ userId: OLENA_ID, url }]);
  });
});

describe('ApplicationDraftsService.announce', () => {
  it('records application.capture_requested with the ai job and request ids in the transaction', async () => {
    const { repository, service, within } = await serviceWith();
    const capture = {
      applicationId: APPLICATION_ID,
      aiJobId: AI_JOB_ID,
      requestId: 'req-capture-1',
    };

    await within((client) => service.announce(OLENA_ID, { ...capture, tx: client }));

    expect(repository.events).toEqual([
      {
        userId: OLENA_ID,
        event: {
          eventType: 'application.capture_requested',
          applicationId: APPLICATION_ID,
          aiJobId: AI_JOB_ID,
          requestId: 'req-capture-1',
        },
        tx,
      },
    ]);
  });
});

describe('ApplicationDraftsService.findRawText', () => {
  it("reads the owner's pasted text", async () => {
    const { service } = await serviceWith();

    await expect(service.findRawText(OLENA_ID, APPLICATION_ID)).resolves.toBe(VACANCY_TEXT);
  });

  it.each([
    { target: "another user's draft", userId: BOHDAN_ID, id: APPLICATION_ID },
    { target: 'a missing draft', userId: OLENA_ID, id: MISSING_ID },
  ])('reads nothing for $target', async ({ userId, id }) => {
    const { service } = await serviceWith();

    await expect(service.findRawText(userId, id)).resolves.toBeNull();
  });
});

describe('ApplicationDraftsService.fill', () => {
  it('writes the parsed fields, clears the draft flag and records application.updated', async () => {
    const { repository, service, within } = await serviceWith();

    await expect(
      within((client) => service.fill(OLENA_ID, { ...FILL, tx: client })),
    ).resolves.toEqual({ createdAt: minutesBefore(2), filledAt: NOW });

    expect(repository.fills).toEqual([
      {
        userId: OLENA_ID,
        id: APPLICATION_ID,
        data: { ...PARSED_VACANCY_COLUMNS, aiParsed: OUTPUT, isDraft: false },
        tx,
      },
    ]);
    expect(repository.events).toEqual([
      {
        userId: OLENA_ID,
        event: {
          eventType: 'application.updated',
          applicationId: APPLICATION_ID,
          fields: [...FILLED_FIELDS, 'isDraft'],
        },
        tx,
      },
    ]);
  });

  it('keeps the draft flag when the parse names no company', async () => {
    const { repository, service, within } = await serviceWith();
    const output = buildVacancyParseOutput({ company: vacancyFieldOf(null, null) });

    await within((client) => service.fill(OLENA_ID, { ...FILL, output, tx: client }));

    expect(repository.fills.map(({ data }) => data.isDraft)).toEqual([true]);
    expect(repository.events.map(({ event }) => event)).toEqual([
      {
        eventType: 'application.updated',
        applicationId: APPLICATION_ID,
        fields: FILLED_FIELDS.filter((field) => field !== 'company'),
      },
    ]);
  });

  it.each([
    { draft: 'already filled', row: { ...DRAFT_ROW, aiParsed: { company: 'Acme' } } },
    { draft: 'the user has confirmed', row: { ...DRAFT_ROW, isDraft: false } },
    { draft: 'that is gone', row: { ...DRAFT_ROW, id: MISSING_ID } },
  ])('fills nothing and records no event for a draft $draft', async ({ row }) => {
    const { repository, service, within } = await serviceWith(row);

    await expect(
      within((client) => service.fill(OLENA_ID, { ...FILL, tx: client })),
    ).resolves.toBeNull();

    expect(repository.events).toEqual([]);
  });
});
