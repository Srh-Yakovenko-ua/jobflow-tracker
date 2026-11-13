import { describe, expect, it } from 'vitest';

import { buildDesignSources } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import {
  type SourcePerformance,
  sourcesQuerySchema,
  sourcesResponseSchema,
} from './analytics-sources.js';

const DESIGN_SOURCES = buildDesignSources();

function djinniOf(sources: SourcePerformance[]): SourcePerformance {
  const djinni = sources.find((row) => row.source === 'djinni');
  if (!djinni) throw new Error('the design body has no Djinni row');
  return djinni;
}

const DJINNI = djinniOf(DESIGN_SOURCES.sources);

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
