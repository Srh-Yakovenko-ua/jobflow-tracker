import { describe, expect, it } from 'vitest';

import { buildMonthlySummaryInput, buildMonthlySummaryOutput } from '../../testing/index.js';
import { keysDeep, PRIVATE_PAYLOAD_KEYS } from '../test/private-payload-keys.js';
import { issuePathsOf } from '../test/zod-issues.js';
import {
  MONTHLY_SUMMARY_LIMITS,
  monthlySummaryInputSchema,
  monthlySummaryOutputSchema,
} from './monthly-summary.js';

const INPUT = buildMonthlySummaryInput();
const OUTPUT = buildMonthlySummaryOutput();
const [FIRST_ACTION] = OUTPUT.actions;

function numbersDeep(value: unknown): unknown[] {
  if (typeof value === 'number') {
    return [value];
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  return Object.values(value).flatMap(numbersDeep);
}

describe('monthlySummaryInputSchema', () => {
  it('keeps the designed limits: 120 words and up to 4 actions', () => {
    expect(MONTHLY_SUMMARY_LIMITS).toMatchObject({
      wordsMax: 120,
      actionsMax: 4,
      summaryMaxLength: 1000,
      titleMaxLength: 120,
      whyMaxLength: 300,
      effectMaxLength: 200,
      metricMaxLength: 120,
    });
  });

  it('accepts the design month built from the analytics bodies', () => {
    expect(monthlySummaryInputSchema.parse(INPUT)).toEqual(INPUT);
  });

  it('carries no key the AI-04 payload guard refuses, at any depth', () => {
    expect(keysDeep(INPUT).filter((key) => PRIVATE_PAYLOAD_KEYS.includes(key))).toEqual([]);
  });

  it('carries only whole numbers, so the model can quote each one', () => {
    expect(numbersDeep(INPUT).filter((value) => !Number.isInteger(value))).toEqual([]);
  });

  it('accepts a search under the forecast threshold with no what-if and no previous plan', () => {
    const small = {
      ...INPUT,
      forecast: { status: 'insufficient_data', have: 9, need: 6 },
      whatIf: null,
      resumeAb: null,
      previousPlan: null,
    };
    expect(monthlySummaryInputSchema.parse(small)).toEqual(small);
  });

  it.for([
    {
      label: 'a fractional conversion percent',
      patch: { funnel: [{ ...INPUT.funnel[0], conversionPercent: 42.5 }] },
      path: 'funnel.0.conversionPercent',
    },
    {
      label: 'a percent above 100',
      patch: { sources: [{ ...INPUT.sources[0], conversionPercent: 101 }] },
      path: 'sources.0.conversionPercent',
    },
    {
      label: 'fractional forecast weeks',
      patch: { forecast: { ...INPUT.forecast, medianWeeks: 4.39 } },
      path: 'forecast.medianWeeks',
    },
    {
      label: 'a fractional month change',
      patch: {
        activity: { ...INPUT.activity, sent: { month: 19, previousMonth: 15, change: 4.5 } },
      },
      path: 'activity.sent.change',
    },
    {
      label: 'a single-digit month',
      patch: { period: { ...INPUT.period, month: '2026-8' } },
      path: 'period.month',
    },
    {
      label: 'a what-if on the offer stage',
      patch: { whatIf: { ...INPUT.whatIf, stage: 'offer' } },
      path: 'whatIf.stage',
    },
    {
      label: 'a top reason with no rejections',
      patch: { reasons: [{ ...INPUT.reasons[0], count: 0 }] },
      path: 'reasons.0.count',
    },
    {
      label: 'eleven insights',
      patch: { insights: Array.from({ length: 11 }, () => INPUT.insights[0]) },
      path: 'insights',
    },
  ])('refuses $label at $path', ({ patch, path }) => {
    const result = monthlySummaryInputSchema.safeParse({ ...INPUT, ...patch });
    expect(issuePathsOf(result)).toEqual([path]);
  });
});

describe('monthlySummaryOutputSchema', () => {
  it('accepts the design summary with four actions', () => {
    expect(monthlySummaryOutputSchema.parse(OUTPUT)).toEqual(OUTPUT);
  });

  it.for([
    { label: 'an empty summary', patch: { summary: '' }, path: 'summary' },
    { label: 'a 1001-character summary', patch: { summary: 'т'.repeat(1001) }, path: 'summary' },
    { label: 'no actions', patch: { actions: [] }, path: 'actions' },
    {
      label: 'five actions',
      patch: { actions: Array.from({ length: 5 }, () => FIRST_ACTION) },
      path: 'actions',
    },
    {
      label: 'a 121-character title',
      patch: { actions: [{ ...FIRST_ACTION, title: 'т'.repeat(121) }] },
      path: 'actions.0.title',
    },
    {
      label: 'a 301-character why',
      patch: { actions: [{ ...FIRST_ACTION, why: 'т'.repeat(301) }] },
      path: 'actions.0.why',
    },
    {
      label: 'a 201-character expected effect',
      patch: { actions: [{ ...FIRST_ACTION, expectedEffect: 'т'.repeat(201) }] },
      path: 'actions.0.expectedEffect',
    },
    {
      label: 'a 121-character metric',
      patch: { actions: [{ ...FIRST_ACTION, metric: 'т'.repeat(121) }] },
      path: 'actions.0.metric',
    },
  ])('refuses $label at $path', ({ patch, path }) => {
    const result = monthlySummaryOutputSchema.safeParse({ ...OUTPUT, ...patch });
    expect(issuePathsOf(result)).toEqual([path]);
  });
});
