import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import {
  type SourcePerformance,
  sourcesQuerySchema,
  type SourcesResponse,
  sourcesResponseSchema,
} from './analytics-sources.js';

const TWO_MORE = {
  status: 'insufficient_data',
  have: 3,
  need: 2,
  message: 'Ще 2 відгуки до першого висновку',
} as const;

const DJINNI = {
  source: 'djinni',
  applications: 24,
  screenings: 9,
  easyApply: 0,
  conversion: { status: 'ok', value: 0.4091, low: 0.2326, high: 0.6127, successes: 9, trials: 22 },
  ghostRate: { status: 'ok', value: 0.0833, low: 0.0232, high: 0.2585, successes: 2, trials: 24 },
  medianResponse: { status: 'ok', days: 6, samples: 22 },
  note: null,
} as const satisfies SourcePerformance;

const DESIGN_SOURCES = {
  sources: [
    DJINNI,
    {
      source: 'dou',
      applications: 11,
      screenings: 2,
      easyApply: 0,
      conversion: {
        status: 'ok',
        value: 0.1818,
        low: 0.0514,
        high: 0.477,
        successes: 2,
        trials: 11,
      },
      ghostRate: { status: 'ok', value: 0, low: 0, high: 0.2588, successes: 0, trials: 11 },
      medianResponse: { status: 'ok', days: 2.5, samples: 11 },
      note: null,
    },
    {
      source: 'linkedin',
      applications: 16,
      screenings: 2,
      easyApply: 6,
      conversion: {
        status: 'ok',
        value: 0.1667,
        low: 0.047,
        high: 0.448,
        successes: 2,
        trials: 12,
      },
      ghostRate: { status: 'ok', value: 0.25, low: 0.1018, high: 0.495, successes: 4, trials: 16 },
      medianResponse: { status: 'ok', days: 12, samples: 12 },
      note: null,
    },
    {
      source: 'referral',
      applications: 3,
      screenings: 3,
      easyApply: 0,
      conversion: TWO_MORE,
      ghostRate: TWO_MORE,
      medianResponse: TWO_MORE,
      note: 'вибірка мала, але напрям однозначний',
    },
    {
      source: 'company_site',
      applications: 2,
      screenings: 1,
      easyApply: 0,
      conversion: {
        status: 'insufficient_data',
        have: 2,
        need: 3,
        message: 'Ще 3 відгуки до першого висновку',
      },
      ghostRate: {
        status: 'insufficient_data',
        have: 2,
        need: 3,
        message: 'Ще 3 відгуки до першого висновку',
      },
      medianResponse: {
        status: 'insufficient_data',
        have: 2,
        need: 3,
        message: 'Ще 3 відгуки до першого висновку',
      },
      note: null,
    },
  ],
  silentGhosts: { total: 6, easyApply: 4 },
} as const satisfies SourcesResponse;

const DJINNI_WITHOUT_NOTE = Object.fromEntries(
  Object.entries(DJINNI).filter(([key]) => key !== 'note'),
);

describe('sourcesQuerySchema', () => {
  it('accepts a query without a search', () => {
    expect(sourcesQuerySchema.parse({})).toEqual({});
  });

  it('refuses a search id that is not a uuid', () => {
    expect(issuePathsOf(sourcesQuerySchema.safeParse({ searchId: '42' }))).toEqual(['searchId']);
  });
});

describe('sourcesResponseSchema', () => {
  it('accepts the design example where Djinni has 9 of 24 and referrals 3 of 3', () => {
    expect(sourcesResponseSchema.parse(DESIGN_SOURCES)).toEqual(DESIGN_SOURCES);
  });

  it.for([
    {
      label: 'an unknown source',
      body: { ...DESIGN_SOURCES, sources: [{ ...DJINNI, source: 'indeed' }] },
      path: 'sources.0.source',
    },
    {
      label: 'a negative application count',
      body: { ...DESIGN_SOURCES, sources: [{ ...DJINNI, applications: -1 }] },
      path: 'sources.0.applications',
    },
    {
      label: 'a row without its note key',
      body: { ...DESIGN_SOURCES, sources: [DJINNI_WITHOUT_NOTE] },
      path: 'sources.0.note',
    },
    {
      label: 'a negative median response',
      body: {
        ...DESIGN_SOURCES,
        sources: [{ ...DJINNI, medianResponse: { status: 'ok', days: -1, samples: 22 } }],
      },
      path: 'sources.0.medianResponse.days',
    },
    {
      label: 'more Easy Apply silent ghosts than silent ghosts',
      body: { ...DESIGN_SOURCES, silentGhosts: { total: 4, easyApply: 6 } },
      path: 'silentGhosts.easyApply',
    },
  ])('refuses $label at $path', ({ body, path }) => {
    expect(issuePathsOf(sourcesResponseSchema.safeParse(body))).toEqual([path]);
  });
});
