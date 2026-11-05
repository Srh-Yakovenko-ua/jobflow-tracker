import { createApplicationResponseSchema } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { appTestingModule, useTestApp } from '../../test/app.js';
import {
  type NewApplicationBody,
  postApplication,
  type SignedInSearcher,
  signedInWithSearch,
} from '../../test/applications.js';
import { type ApplicationRowInput, createApplicationRows } from '../../test/factories.js';
import { daysBefore, NOW, settableClock } from '../../test/time.js';
import { ApplicationsService } from './applications.service.js';

type DuplicateCase = {
  case: string;
  row: ApplicationRowInput;
  probe: NewApplicationBody;
  flagged: boolean;
};

const ACME_PROBE = {
  company: 'Acme Technologies LLC',
  position: 'Senior React Developer',
} satisfies NewApplicationBody;

const ACME_ROW = {
  company: 'Acme Technologies',
  position: 'Senior React Developer',
  lastEventAt: daysBefore(1),
} satisfies ApplicationRowInput;

const VACANCY_URL = 'https://djinni.co/jobs/812345-senior-react-developer/';

const OLD_URL_ROW = {
  company: 'Globex',
  position: 'QA Engineer',
  url: VACANCY_URL,
  appliedAt: daysBefore(200),
  lastEventAt: daysBefore(200),
} satisfies ApplicationRowInput;

const INITECH_PROBE = {
  company: 'Initech',
  position: 'Backend developer',
} satisfies NewApplicationBody;

const ROMASHKA_ROW = {
  company: 'ТОВ «Ромашка»',
  position: 'Розробник React',
  appliedAt: daysBefore(1),
  lastEventAt: daysBefore(1),
} satisfies ApplicationRowInput;

const clock = settableClock(NOW);

describe('the possible duplicates of a new application', () => {
  const testApp = useTestApp(() => appTestingModule().overrideProvider(Clock).useValue(clock));

  const rowsFor = (owner: SignedInSearcher, rows: ApplicationRowInput[]) =>
    createApplicationRows(testApp.prisma, { ...owner, rows });

  async function post(owner: SignedInSearcher, input: NewApplicationBody) {
    const response = await postApplication(testApp.app, {
      accessToken: owner.accessToken,
      input,
    });
    const count = await testApp.prisma.application.count({ where: { userId: owner.userId } });
    return {
      status: response.status,
      count,
      body: createApplicationResponseSchema.parse(response.body),
    };
  }

  it('flags acme technologies / Senior React Dev for Acme Technologies LLC / Senior React Developer and still creates it', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const [id] = await rowsFor(olena, [
      {
        company: 'acme technologies',
        position: 'Senior React Dev',
        appliedAt: daysBefore(23),
        lastEventAt: daysBefore(23),
      },
    ]);

    const { status, count, body } = await post(olena, ACME_PROBE);

    expect([status, count]).toEqual([201, 2]);
    expect(body.possibleDuplicates).toEqual([
      {
        id,
        company: 'acme technologies',
        position: 'Senior React Dev',
        stage: 'applied',
        appliedAt: '2026-09-29T09:00:00.000Z',
      },
    ]);
  });

  it('does not flag Globex / Senior React Developer for Acme Technologies LLC / Senior React Developer', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    await rowsFor(olena, [{ ...ACME_ROW, company: 'Globex', appliedAt: daysBefore(1) }]);

    const { status, body } = await post(olena, ACME_PROBE);

    expect([status, body.possibleDuplicates]).toEqual([201, []]);
  });

  it.each<DuplicateCase>([
    {
      case: 'the same URL with www and no trailing slash, 200 days old under another company',
      row: OLD_URL_ROW,
      probe: { ...INITECH_PROBE, url: 'https://www.djinni.co/jobs/812345-senior-react-developer' },
      flagged: true,
    },
    {
      case: 'the same URL with a utm_source query',
      row: OLD_URL_ROW,
      probe: { ...INITECH_PROBE, url: `${VACANCY_URL}?utm_source=telegram` },
      flagged: true,
    },
    {
      case: 'the same URL over http with a #hash',
      row: OLD_URL_ROW,
      probe: {
        ...INITECH_PROBE,
        url: 'http://DJINNI.co/jobs/812345-senior-react-developer#apply',
      },
      flagged: true,
    },
    {
      case: 'another vacancy id on the same site',
      row: OLD_URL_ROW,
      probe: { ...INITECH_PROBE, url: 'https://djinni.co/jobs/812346-senior-react-developer/' },
      flagged: false,
    },
    {
      case: 'the same company and position applied 89 days ago',
      row: { ...ACME_ROW, appliedAt: daysBefore(89) },
      probe: ACME_PROBE,
      flagged: true,
    },
    {
      case: 'the same company and position applied 91 days ago',
      row: { ...ACME_ROW, appliedAt: daysBefore(91) },
      probe: ACME_PROBE,
      flagged: false,
    },
    {
      case: 'a draft of the same company and position created 10 days ago without appliedAt',
      row: { ...ACME_ROW, isDraft: true, appliedAt: null, createdAt: daysBefore(10) },
      probe: ACME_PROBE,
      flagged: true,
    },
    {
      case: 'the same company with position QA Engineer',
      row: { ...ACME_ROW, position: 'QA Engineer', appliedAt: daysBefore(1) },
      probe: ACME_PROBE,
      flagged: false,
    },
    {
      case: 'a deleted application of the same company and position',
      row: { ...ACME_ROW, appliedAt: daysBefore(1), deletedAt: daysBefore(1) },
      probe: ACME_PROBE,
      flagged: false,
    },
    {
      case: 'ТОВ «Ромашка» / Розробник React for ромашка / Розробниця React',
      row: ROMASHKA_ROW,
      probe: { company: 'ромашка', position: 'Розробниця React' },
      flagged: true,
    },
    {
      case: 'ТОВ «Ромашка» / Розробник React for ромашка / Тестувальник React',
      row: ROMASHKA_ROW,
      probe: { company: 'ромашка', position: 'Тестувальник React' },
      flagged: false,
    },
    {
      case: 'a company of only LLC for a company of only ТОВ',
      row: { ...ACME_ROW, company: 'LLC', appliedAt: daysBefore(1) },
      probe: { ...ACME_PROBE, company: 'ТОВ' },
      flagged: false,
    },
  ])(
    'creates the application and flags it: $flagged for $case',
    async ({ row, probe, flagged }) => {
      const olena = await signedInWithSearch(testApp.prisma);
      const ids = await rowsFor(olena, [row]);

      const { status, count, body } = await post(olena, probe);

      expect([status, count]).toEqual([201, 2]);
      expect(body.possibleDuplicates.map(({ id }) => id)).toEqual(flagged ? ids : []);
    },
  );

  it('lists the five newest of six duplicates, newest first', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const ids = await rowsFor(
      olena,
      [3, 1, 6, 2, 5, 4].map((days) => ({ ...ACME_ROW, appliedAt: daysBefore(days) })),
    );
    const [three, one, , two, five, four] = ids;

    const { body } = await post(olena, ACME_PROBE);

    expect(body.possibleDuplicates.map(({ id }) => id)).toEqual([one, two, three, four, five]);
  });

  it("flags BOHDAN's own application for him but never for OLENA", async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);
    const [bohdanId] = await rowsFor(bohdan, [{ ...ACME_ROW, appliedAt: daysBefore(1) }]);

    const forOlena = await post(olena, ACME_PROBE);
    const forBohdan = await post(bohdan, ACME_PROBE);

    expect(forOlena.body.possibleDuplicates).toEqual([]);
    expect(forBohdan.body.possibleDuplicates.map(({ id }) => id)).toEqual([bohdanId]);
  });

  it('finds a captured URL alone through ApplicationsService.possibleDuplicates with its stage and appliedAt', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const [id] = await rowsFor(olena, [
      { ...OLD_URL_ROW, currentStage: 'rejected', appliedAt: daysBefore(23) },
    ]);

    const duplicates = await testApp.app.get(ApplicationsService).possibleDuplicates(olena.userId, {
      url: 'https://www.djinni.co/jobs/812345-senior-react-developer?utm_source=bookmarklet',
    });

    expect(duplicates).toEqual([
      {
        id,
        company: 'Globex',
        position: 'QA Engineer',
        stage: 'rejected',
        appliedAt: '2026-09-29T09:00:00.000Z',
      },
    ]);
  });

  it.each([
    {
      company: 'Acme Technologies LLC',
      companyKey: 'acme technologies',
      url: 'https://www.Djinni.co/jobs/1-react/',
      urlKey: 'djinni.co/jobs/1-react',
    },
    {
      company: 'ТОВ «Ромашка»',
      companyKey: 'ромашка',
      url: 'http://djinni.co/jobs/1-react?utm_source=telegram#apply',
      urlKey: 'djinni.co/jobs/1-react',
    },
    {
      company: 'Johnson & Johnson, Inc.',
      companyKey: 'johnson johnson',
      url: 'https://jobs.dou.ua/companies/acme/vacancies/42//',
      urlKey: 'jobs.dou.ua/companies/acme/vacancies/42',
    },
    {
      company: 'ПрАТ "Київстар"',
      companyKey: 'київстар',
      url: 'https://WWW.LinkedIn.com/jobs/view/42/?trk=public_jobs',
      urlKey: 'linkedin.com/jobs/view/42',
    },
    {
      company: 'ФОП Ліпа Tovarystvo Inc Ltd',
      companyKey: 'ліпа tovarystvo',
      url: 'https://www.work.ua/jobs/123/',
      urlKey: 'work.ua/jobs/123',
    },
    { company: 'ТОВ', companyKey: null, url: 'https://', urlKey: null },
  ])(
    'keys the company $company as $companyKey and the URL $url as $urlKey',
    async ({ company, companyKey, url, urlKey }) => {
      const keys = await testApp.prisma.$queryRaw`
        SELECT jobflow_company_key(${company}::text) AS "companyKey",
          jobflow_url_key(${url}::text) AS "urlKey"`;

      expect(keys).toEqual([{ companyKey, urlKey }]);
    },
  );
});
