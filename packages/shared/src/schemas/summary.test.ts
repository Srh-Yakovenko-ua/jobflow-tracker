import { describe, expect, it } from 'vitest';

import { buildSummary } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import {
  SUMMARY_LIMITS,
  type SummaryArchive,
  summaryArchiveSchema,
  type SummaryResponse,
  summaryResponseSchema,
} from './summary.js';

const SUMMARY = buildSummary();
const AI_JOB_ID = SUMMARY.aiJobId;

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

describe('summaryArchiveSchema', () => {
  it.each<[string, SummaryArchive]>([
    ['a month whose plan is 3 of 4 done', { items: [{ ...SUMMARY, plan: { items: 4, done: 3 } }] }],
    ['a month with no plan saved', { items: [{ ...SUMMARY, plan: null }] }],
    ['no summarized month yet', { items: [] }],
  ])('accepts %s', (_label, body) => {
    expect(summaryArchiveSchema.parse(body)).toStrictEqual(body);
  });

  it('refuses a list longer than 12 months', () => {
    const items = Array.from({ length: SUMMARY_LIMITS.archiveMonths + 1 }, () => ({
      ...SUMMARY,
      plan: null,
    }));
    expect(SUMMARY_LIMITS.archiveMonths).toBe(12);
    expect(issuePathsOf(summaryArchiveSchema.safeParse({ items }))).toEqual(['items']);
  });

  it('refuses an archive month without its plan field', () => {
    expect(issuePathsOf(summaryArchiveSchema.safeParse({ items: [SUMMARY] }))).toEqual([
      'items.0.plan',
    ]);
  });
});
