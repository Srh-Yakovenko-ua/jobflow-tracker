import { type ApplicationResponse, applicationResponseSchema } from '../src/schemas/application.js';
import {
  APPLICATION_CARD_STACK_LIMIT,
  type ApplicationListResponse,
  applicationListResponseSchema,
} from '../src/schemas/application-list.js';
import { buildVacancyParseOutput, vacancyFieldOf } from './ai.js';

export type DesignOfferCount = 2 | 3 | 4;

const OFFER_DAY = '2026-11-02T10:00:00Z';

const OFFER_BASE: ApplicationResponse = {
  id: '0b6f3c1e-5d2a-4c8e-9f10-000000000500',
  searchId: '0b6f3c1e-5d2a-4c8e-9f10-0000000005ff',
  company: 'Offer base',
  position: 'Frontend Engineer',
  url: null,
  source: 'linkedin',
  salaryMin: null,
  salaryMax: null,
  currency: null,
  stack: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
  location: null,
  workMode: null,
  currentStage: 'offer',
  isDraft: false,
  resumeVersionId: null,
  matchScore: null,
  aiParsed: null,
  rawText: null,
  appliedAt: '2026-10-05T08:00:00Z',
  lastEventAt: OFFER_DAY,
  createdAt: '2026-10-05T08:00:00Z',
  updatedAt: OFFER_DAY,
  daysInStage: 4,
  daysSinceLastEvent: 4,
  silenceLevel: 'none',
};

const GROSS_EUR_PARSE = buildVacancyParseOutput({
  company: vacancyFieldOf('Northwind Labs', 'Northwind Labs'),
  salaryMin: vacancyFieldOf(4000, '4000 EUR gross'),
  salaryMax: vacancyFieldOf(4000, '4000 EUR gross'),
  currency: vacancyFieldOf('EUR', 'EUR'),
  salaryTax: vacancyFieldOf('gross', 'gross'),
  location: vacancyFieldOf('Lviv', 'Lviv'),
  workMode: vacancyFieldOf('office', 'office'),
});

const DESIGN_OFFERS: readonly Partial<ApplicationResponse>[] = [
  {
    id: '0b6f3c1e-5d2a-4c8e-9f10-000000000501',
    company: 'Trident Systems',
    salaryMin: 5000,
    salaryMax: 5000,
    currency: 'USD',
    matchScore: 80,
    workMode: 'remote',
    location: 'Kyiv',
  },
  {
    id: '0b6f3c1e-5d2a-4c8e-9f10-000000000502',
    company: 'Northwind Labs',
    salaryMin: 4000,
    salaryMax: 4000,
    currency: 'EUR',
    matchScore: 92,
    workMode: 'office',
    location: 'Lviv',
    aiParsed: GROSS_EUR_PARSE,
  },
  {
    id: '0b6f3c1e-5d2a-4c8e-9f10-000000000503',
    company: 'Lumen Pay',
    salaryMin: 200000,
    salaryMax: 200000,
    currency: 'UAH',
    workMode: 'hybrid',
  },
  {
    id: '0b6f3c1e-5d2a-4c8e-9f10-000000000504',
    company: 'Orbit Health',
    matchScore: 60,
    workMode: 'remote',
  },
];

export function buildDesignOffers(count: DesignOfferCount): ApplicationResponse[] {
  return DESIGN_OFFERS.slice(0, count).map((offer) =>
    applicationResponseSchema.parse({ ...OFFER_BASE, ...offer }),
  );
}

function listItemOf(offer: ApplicationResponse) {
  return {
    ...offer,
    stack: offer.stack.slice(0, APPLICATION_CARD_STACK_LIMIT),
    stackCount: offer.stack.length,
    nextScheduledEvent: null,
    aiStatus: null,
    aiJobId: null,
    snippet: null,
  };
}

export function buildOfferList(offers: readonly ApplicationResponse[]): ApplicationListResponse {
  return applicationListResponseSchema.parse({ items: offers.map(listItemOf), nextCursor: null });
}
