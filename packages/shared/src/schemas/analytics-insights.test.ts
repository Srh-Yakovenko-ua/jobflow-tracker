import { describe, expect, it } from 'vitest';

import { designInsightsBody } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { insightsResponseSchema } from './analytics-insights.js';

const DESIGN_INSIGHTS = designInsightsBody();

describe('insightsResponseSchema', () => {
  it('accepts the six design headlines from the analytics snapshot', () => {
    expect(insightsResponseSchema.parse(DESIGN_INSIGHTS)).toEqual(DESIGN_INSIGHTS);
  });

  it('accepts an empty list below the insight threshold', () => {
    expect(insightsResponseSchema.parse({ insights: [] })).toEqual({ insights: [] });
  });

  it.for([
    { label: 'an unknown block', change: { block: 'kpis' }, path: 'insights.0.block' },
    { label: 'an empty title', change: { title: '' }, path: 'insights.0.title' },
    { label: 'an unknown severity', change: { severity: 'danger' }, path: 'insights.0.severity' },
    {
      label: 'evidence that is not a string or a number',
      change: { evidence: { ghosted: true } },
      path: 'insights.0.evidence.ghosted',
    },
  ])('refuses $label at $path', ({ change, path }) => {
    const [first, ...rest] = DESIGN_INSIGHTS.insights;
    const body = { insights: [{ ...first, ...change }, ...rest] };
    expect(issuePathsOf(insightsResponseSchema.safeParse(body))).toEqual([path]);
  });
});
