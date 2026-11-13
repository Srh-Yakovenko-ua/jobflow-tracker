import { describe, expect, it } from 'vitest';

import { buildDesignResumeAb, buildDesignResumeAbComparison } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { type ResumeAbResponse, resumeAbResponseSchema } from './analytics-resume-ab.js';

const DESIGN_COMPARISON = buildDesignResumeAbComparison();

const DESIGN_RESUME_AB = buildDesignResumeAb();

const TWO_PER_VERSION = {
  versions: [],
  comparison: {
    ...DESIGN_COMPARISON,
    difference: 1,
    test: 'fisher_exact',
    pValue: 0.3333,
    probabilityBetter: 0.95,
    verdict: {
      status: 'insufficient_data',
      have: 2,
      need: 8,
      message: 'Ще 8 відгуків до першого висновку',
    },
  },
} as const satisfies ResumeAbResponse;

describe('resumeAbResponseSchema', () => {
  it('accepts the design example where CV v2 has 11 of 27 and CV v1 5 of 21', () => {
    expect(resumeAbResponseSchema.parse(DESIGN_RESUME_AB)).toEqual(DESIGN_RESUME_AB);
  });

  it('carries the titles and switch time the analytics design body returns', () => {
    expect({
      titles: DESIGN_RESUME_AB.versions.map((version) => version.title),
      at: DESIGN_RESUME_AB.comparison?.switch.at,
    }).toEqual({
      titles: ['для дизайн-ролей', 'акцент на продукті', 'хронологічне'],
      at: '2026-12-02T09:00:00Z',
    });
  });

  it('accepts an insufficient verdict for two applications per version', () => {
    expect(resumeAbResponseSchema.parse(TWO_PER_VERSION)).toEqual(TWO_PER_VERSION);
  });

  it('accepts a user with no versions to compare', () => {
    expect(resumeAbResponseSchema.parse({ versions: [], comparison: null })).toEqual({
      versions: [],
      comparison: null,
    });
  });

  it.for([
    {
      label: 'a winner numbered 0',
      comparison: {
        ...DESIGN_COMPARISON,
        verdict: { ...DESIGN_COMPARISON.verdict, winner: 0 },
      },
      path: 'comparison.verdict.winner',
    },
    {
      label: 'a p value above 1',
      comparison: { ...DESIGN_COMPARISON, pValue: 1.2 },
      path: 'comparison.pValue',
    },
    {
      label: 'an unknown test name',
      comparison: { ...DESIGN_COMPARISON, test: 't_test' },
      path: 'comparison.test',
    },
    {
      label: 'a difference below -1',
      comparison: { ...DESIGN_COMPARISON, difference: -1.5 },
      path: 'comparison.difference',
    },
    {
      label: 'a switch time that is not ISO',
      comparison: { ...DESIGN_COMPARISON, switch: { ...DESIGN_COMPARISON.switch, at: 'March' } },
      path: 'comparison.switch.at',
    },
  ])('refuses $label at $path', ({ comparison, path }) => {
    const body = { ...DESIGN_RESUME_AB, comparison };
    expect(issuePathsOf(resumeAbResponseSchema.safeParse(body))).toEqual([path]);
  });
});
