import type { PossibleDuplicate } from '@jobflow/shared';
import { buildVacancyParseOutput, vacancyFieldOf } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AI_JOB_ID, PARSED_VACANCY_COLUMNS, VACANCY_TEXT } from '../../test/ai.js';
import { BLANK_DRAFT_COLUMNS, POSSIBLE_DUPLICATE } from '../../test/capture.js';
import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import { type ByUser, RecordedEvents } from '../../test/recorded-events.js';
import {
  APPLICATION_ID,
  APPLICATION_NOT_FOUND,
  APPLICATION_ROW,
  BOHDAN_ID,
  MISSING_ID,
  MISSING_TARGETS,
  OLENA_ID,
} from '../../test/service-fixtures.js';
import { minutesBefore, NOW } from '../../test/time.js';
import { ApplicationDraftsService } from './application-drafts.service.js';
import type { DuplicateProbe } from './application-duplicates.repository.js';
import {
  type ApplicationById,
  type ApplicationRow,
  ApplicationsRepository,
  type DraftRow,
  type FillDraft,
  type LockedDraft,
  type RecordApplicationEvent,
  type UpdateApplicationById,
} from './applications.repository.js';
import { ApplicationsService, type InsertApplied } from './applications.service.js';

const tx = FAKE_TRANSACTION;

const EDITED_DRAFT_ROW: ApplicationRow = {
  ...APPLICATION_ROW,
  isDraft: true,
  aiParsed: null,
  rawText: VACANCY_TEXT,
  createdAt: minutesBefore(2),
};

const DRAFT_ROW: ApplicationRow = { ...EDITED_DRAFT_ROW, ...BLANK_DRAFT_COLUMNS };

const CONFIRM = { applicationId: APPLICATION_ID };

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

  readonly updates: ByUser<UpdateApplicationById>[] = [];

  readonly confirmed: ByUser<ApplicationById>[] = [];

  readonly locked: ByUser<ApplicationById>[] = [];

  parseRunning = false;

  constructor(private readonly row: ApplicationRow) {
    super();
  }

  findOwned(userId: string, { id }: ApplicationById): Promise<ApplicationRow | null> {
    return Promise.resolve(userId === OLENA_ID && id === this.row.id ? this.row : null);
  }

  async fillDraft(userId: string, input: FillDraft): Promise<DraftRow | null> {
    this.fills.push({ userId, ...input });
    const row = await this.findOwned(userId, input);
    return row?.isDraft === true && row.aiParsed === null ? row : null;
  }

  updateOwned(userId: string, input: UpdateApplicationById): Promise<number> {
    this.updates.push({ userId, ...input });
    return Promise.resolve(1);
  }

  async lockDraft(userId: string, input: ApplicationById): Promise<LockedDraft | null> {
    const row = await this.findOwned(userId, input);
    if (row === null) {
      return null;
    }
    this.locked.push({ userId, ...input });
    return {
      isDraft: row.isDraft,
      parsed: row.aiParsed !== null,
      hasText: row.rawText !== null,
      runningJobId: this.parseRunning ? AI_JOB_ID : null,
    };
  }

  async confirmDraft(userId: string, input: ApplicationById): Promise<number> {
    const row = await this.findOwned(userId, input);
    if (row?.isDraft !== true || this.parseRunning) {
      return 0;
    }
    this.confirmed.push({ userId, ...input });
    return 1;
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
          salaryMin: null,
          salaryMax: null,
          currency: null,
          location: null,
          workMode: null,
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

  it.each([
    { page: 'a djinni.co url', url: 'https://djinni.co/jobs/700123-react/', source: 'djinni' },
    {
      page: 'a jobs.dou.ua url',
      url: 'https://jobs.dou.ua/companies/acme/vacancies/7/',
      source: 'dou',
    },
    {
      page: 'a www.linkedin.com url',
      url: 'https://www.linkedin.com/jobs/view/7/',
      source: 'linkedin',
    },
    { page: 'an unknown host', url: 'https://jobs.example.test/7', source: 'other' },
    { page: 'a lookalike of djinni.co', url: 'https://djinni.co.example.test/7', source: 'other' },
    { page: 'no url', url: undefined, source: 'other' },
  ])('stores the source $source for a draft opened from $page', async ({ url, source }) => {
    const { applications, service, within } = await serviceWith();
    const input = { text: VACANCY_TEXT, url };

    await within((client) => service.open(OLENA_ID, { input, tx: client }));

    expect(applications.inserted.map(({ fields }) => fields.source)).toEqual([source]);
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
        data: { aiParsed: OUTPUT, isDraft: false },
        tx,
      },
    ]);
    expect(repository.updates).toEqual([
      { userId: OLENA_ID, id: APPLICATION_ID, data: PARSED_VACANCY_COLUMNS, tx },
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

  it('keeps a position the user changed while the parse ran', async () => {
    const row = { ...DRAFT_ROW, position: 'Lead React developer' };
    const { repository, service, within } = await serviceWith(row);

    await within((client) => service.fill(OLENA_ID, { ...FILL, tx: client }));

    expect(repository.updates.map(({ data }) => data)).toEqual([
      { ...PARSED_VACANCY_COLUMNS, position: undefined },
    ]);
    expect(repository.events.map(({ event }) => event)).toEqual([
      {
        eventType: 'application.updated',
        applicationId: APPLICATION_ID,
        fields: [...FILLED_FIELDS.filter((field) => field !== 'position'), 'isDraft'],
      },
    ]);
  });

  it('writes only the parse when the user changed every field while it ran', async () => {
    const { repository, service, within } = await serviceWith(EDITED_DRAFT_ROW);

    await within((client) => service.fill(OLENA_ID, { ...FILL, tx: client }));

    expect(repository.fills.map(({ data }) => data)).toEqual([
      { aiParsed: OUTPUT, isDraft: false },
    ]);
    expect(repository.updates).toEqual([]);
    expect(repository.events.map(({ event }) => event)).toEqual([
      {
        eventType: 'application.updated',
        applicationId: APPLICATION_ID,
        fields: ['aiParsed', 'isDraft'],
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

describe('ApplicationDraftsService.confirm', () => {
  it('clears the draft flag at the confirm time and records application.updated in the transaction', async () => {
    const { repository, service, within } = await serviceWith();

    await expect(
      within((client) => service.confirm(OLENA_ID, { ...CONFIRM, tx: client })),
    ).resolves.toEqual(NOW);

    expect(repository.confirmed).toEqual([{ userId: OLENA_ID, id: APPLICATION_ID, tx }]);
    expect(repository.events).toEqual([
      {
        userId: OLENA_ID,
        event: {
          eventType: 'application.updated',
          applicationId: APPLICATION_ID,
          fields: ['isDraft'],
        },
        tx,
      },
    ]);
  });

  it.each([
    {
      card: 'that is not a draft',
      row: { ...DRAFT_ROW, isDraft: false },
      parseRunning: false,
      detail: 'Application is not a draft',
    },
    {
      card: 'whose vacancy parse is still queued',
      row: DRAFT_ROW,
      parseRunning: true,
      detail: 'Vacancy parse is still running',
    },
  ])(
    'refuses a card $card with 409 and records no event',
    async ({ row, parseRunning, detail }) => {
      const { repository, service, within } = await serviceWith(row);
      repository.parseRunning = parseRunning;

      await expect(
        within((client) => service.confirm(OLENA_ID, { ...CONFIRM, tx: client })),
      ).rejects.toMatchObject({ body: { status: 409, detail } });

      expect([repository.confirmed, repository.events]).toEqual([[], []]);
    },
  );

  it.each(MISSING_TARGETS)('answers 404 for $case and records no event', async ({ userId, id }) => {
    const { repository, service, within } = await serviceWith();

    await expect(
      within((client) => service.confirm(userId, { applicationId: id, tx: client })),
    ).rejects.toMatchObject(APPLICATION_NOT_FOUND);

    expect([repository.confirmed, repository.events]).toEqual([[], []]);
  });
});

describe('ApplicationDraftsService.lockForRetry', () => {
  it('locks the draft in the transaction and names no running parse once the parse has failed', async () => {
    const { repository, service, within } = await serviceWith();

    await expect(
      within((client) => service.lockForRetry(OLENA_ID, { ...CONFIRM, tx: client })),
    ).resolves.toBeNull();

    expect(repository.locked).toEqual([{ userId: OLENA_ID, id: APPLICATION_ID, tx }]);
  });

  it('answers the id of the vacancy parse that is still queued or processing', async () => {
    const { repository, service, within } = await serviceWith();
    repository.parseRunning = true;

    await expect(
      within((client) => service.lockForRetry(OLENA_ID, { ...CONFIRM, tx: client })),
    ).resolves.toBe(AI_JOB_ID);
  });

  it.each([
    {
      card: 'that is not a draft',
      row: { ...DRAFT_ROW, isDraft: false },
      detail: 'Application is not a draft',
    },
    {
      card: 'whose vacancy is already parsed',
      row: { ...DRAFT_ROW, aiParsed: { company: 'Acme' } },
      detail: 'Vacancy is already parsed',
    },
    {
      card: 'that keeps no vacancy text',
      row: { ...DRAFT_ROW, rawText: null },
      detail: 'Draft has no vacancy text',
    },
  ])('refuses to parse a card $card again with 409', async ({ row, detail }) => {
    const { service, within } = await serviceWith(row);

    await expect(
      within((client) => service.lockForRetry(OLENA_ID, { ...CONFIRM, tx: client })),
    ).rejects.toMatchObject({ body: { status: 409, detail } });
  });

  it.each(MISSING_TARGETS)('answers 404 for $case and locks nothing', async ({ userId, id }) => {
    const { repository, service, within } = await serviceWith();

    await expect(
      within((client) => service.lockForRetry(userId, { applicationId: id, tx: client })),
    ).rejects.toMatchObject(APPLICATION_NOT_FOUND);

    expect(repository.locked).toEqual([]);
  });
});
