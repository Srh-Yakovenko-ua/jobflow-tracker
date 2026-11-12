import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import { applicationMatchResponseSchema, matchBreakdownSchema } from './match.js';

const BREAKDOWN = {
  score: 68,
  matched: [
    { name: 'React + TypeScript', weight: 'must', coverage: 'full', pointsLost: 0 },
    { name: 'GraphQL', weight: 'nice', coverage: 'partial', pointsLost: 4 },
  ],
  missing: [{ name: 'AWS / інфраструктура', weight: 'must', pointsLost: 21 }],
  ignored: [{ name: 'Домен fintech', coverage: 'missing' }],
  explanation: 'Стек збігається, бракує AWS.',
};

const MATCH = {
  ...BREAKDOWN,
  resumeVersion: {
    id: '01920000-0000-7000-8000-000000000060',
    number: 2,
    title: 'для продуктових',
  },
  computedAt: '2026-08-14T09:30:00.000Z',
};

describe('matchBreakdownSchema', () => {
  it('accepts a score with matched, missing and ignored requirements and their point impact', () => {
    expect(matchBreakdownSchema.parse(BREAKDOWN)).toEqual(BREAKDOWN);
  });

  it.for([
    { label: 'a score above 100', patch: { score: 101 }, path: 'score' },
    { label: 'a negative score', patch: { score: -1 }, path: 'score' },
    { label: 'a fractional score', patch: { score: 67.5 }, path: 'score' },
    {
      label: 'a missing requirement in the matched list',
      patch: { matched: [{ ...BREAKDOWN.matched[0], coverage: 'missing' }] },
      path: 'matched.0.coverage',
    },
    {
      label: 'a mentioned requirement in the matched list',
      patch: { matched: [{ ...BREAKDOWN.matched[0], weight: 'mentioned' }] },
      path: 'matched.0.weight',
    },
    {
      label: 'a mentioned requirement in the missing list',
      patch: { missing: [{ ...BREAKDOWN.missing[0], weight: 'mentioned' }] },
      path: 'missing.0.weight',
    },
    {
      label: 'negative points lost',
      patch: { missing: [{ ...BREAKDOWN.missing[0], pointsLost: -21 }] },
      path: 'missing.0.pointsLost',
    },
  ])('refuses $label at $path', ({ patch, path }) => {
    expect(issuePathsOf(matchBreakdownSchema.safeParse({ ...BREAKDOWN, ...patch }))).toEqual([
      path,
    ]);
  });
});

const QUEUED_JOB = { id: '01920000-0000-7000-8000-000000000070', status: 'queued' };

describe('applicationMatchResponseSchema', () => {
  it.for([
    { label: 'no match and no match job yet', body: { match: null, job: null } },
    { label: 'a match job queued for the linked version', body: { match: null, job: QUEUED_JOB } },
    { label: 'a match against a resume version', body: { match: MATCH, job: null } },
  ])('accepts $label', ({ body }) => {
    expect(applicationMatchResponseSchema.parse(body)).toEqual(body);
  });

  it.for([
    {
      label: 'a computedAt that is not an ISO date-time',
      body: { match: { ...MATCH, computedAt: '14.08.2026' }, job: null },
      path: 'match.computedAt',
    },
    {
      label: 'an unknown match job status',
      body: { match: null, job: { ...QUEUED_JOB, status: 'running' } },
      path: 'job.status',
    },
    { label: 'a body without the job field', body: { match: null }, path: 'job' },
  ])('refuses $label at $path', ({ body, path }) => {
    expect(issuePathsOf(applicationMatchResponseSchema.safeParse(body))).toEqual([path]);
  });
});
