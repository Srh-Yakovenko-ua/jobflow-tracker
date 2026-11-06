import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import {
  rejectionReasonsSummaryQuerySchema,
  rejectionReasonsSummarySchema,
} from './rejection-reasons-summary.js';

const SUMMARY = {
  stage: 'tech_interview',
  total: 3,
  reasons: [
    { code: 'skills_gap', count: 2 },
    { code: 'chose_other', count: 1 },
  ],
} as const;

describe('rejectionReasonsSummaryQuerySchema', () => {
  it('keeps a known stage', () => {
    expect(rejectionReasonsSummaryQuerySchema.parse({ stage: 'screening' })).toEqual({
      stage: 'screening',
    });
  });

  it('keeps the search id of a finished search', () => {
    const query = { stage: 'tech_interview', searchId: '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a2b' };
    expect(rejectionReasonsSummaryQuerySchema.parse(query)).toEqual(query);
  });

  it.for([
    { label: 'a missing stage', query: {}, path: 'stage' },
    { label: 'an unknown stage', query: { stage: 'hired' }, path: 'stage' },
    {
      label: 'a search id that is not a uuid',
      query: { stage: 'screening', searchId: '42' },
      path: 'searchId',
    },
  ])('refuses $label at $path', ({ query, path }) => {
    expect(issuePathsOf(rejectionReasonsSummaryQuerySchema.safeParse(query))).toEqual([path]);
  });
});

describe('rejectionReasonsSummarySchema', () => {
  it('accepts the summary of three rejections at tech_interview', () => {
    expect(rejectionReasonsSummarySchema.parse(SUMMARY)).toEqual(SUMMARY);
  });

  it('accepts a stage with no rejections', () => {
    const empty = { stage: 'offer', total: 0, reasons: [] };
    expect(rejectionReasonsSummarySchema.parse(empty)).toEqual(empty);
  });

  it.for([
    {
      label: 'a reason counted 0 times',
      body: { ...SUMMARY, reasons: [{ code: 'skills_gap', count: 0 }] },
      path: 'reasons.0.count',
    },
    {
      label: 'an unknown reason code',
      body: { ...SUMMARY, reasons: [{ code: 'bored', count: 1 }] },
      path: 'reasons.0.code',
    },
    { label: 'a negative total', body: { ...SUMMARY, total: -1 }, path: 'total' },
  ])('refuses $label at $path', ({ body, path }) => {
    expect(issuePathsOf(rejectionReasonsSummarySchema.safeParse(body))).toEqual([path]);
  });
});
