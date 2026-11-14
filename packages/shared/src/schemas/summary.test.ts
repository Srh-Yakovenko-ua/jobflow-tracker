import { describe, expect, it } from 'vitest';

import { buildMonthlySummaryOutput } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { type SummaryResponse, summaryResponseSchema } from './summary.js';

const AI_JOB_ID = '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e40';

const { summary: text, actions } = buildMonthlySummaryOutput();

const SUMMARY = {
  aiJobId: AI_JOB_ID,
  month: '2026-08',
  text,
  actions,
  generatedAt: '2026-09-01T04:00:12.000Z',
  planId: null,
};

describe('summaryResponseSchema', () => {
  it.each<[string, SummaryResponse]>([
    ['a done summary with no plan saved', { summary: SUMMARY, job: null }],
    [
      'a summary being regenerated next to the last one',
      { summary: SUMMARY, job: { id: AI_JOB_ID, status: 'processing' } },
    ],
    ['no summary yet', { summary: null, job: null }],
  ])('accepts %s', (_label, body) => {
    expect(summaryResponseSchema.parse(body)).toStrictEqual(body);
  });

  it.for([
    { label: 'a month with a day', patch: { month: '2026-08-01' }, path: 'summary.month' },
    { label: 'no actions', patch: { actions: [] }, path: 'summary.actions' },
    { label: 'a plan id that is not a uuid', patch: { planId: '7' }, path: 'summary.planId' },
  ])('refuses $label at $path', ({ patch, path }) => {
    const body = { summary: { ...SUMMARY, ...patch }, job: null };
    expect(issuePathsOf(summaryResponseSchema.safeParse(body))).toEqual([path]);
  });
});
