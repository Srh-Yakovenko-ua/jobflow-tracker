import { describe, expect, it } from 'vitest';

import {
  finishSearchInputSchema,
  finishSearchResponseSchema,
  searchListResponseSchema,
  searchSummarySchema,
} from './searches.js';
import { issuePathsOf } from './test/zod-issues.js';

const FINISHED_SEARCH = {
  id: '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a2b',
  title: 'Мій пошук',
  status: 'archived',
  outcome: 'offer_accepted',
  startedAt: '2026-09-01T09:00:00.000Z',
  finishedAt: '2026-10-12T09:00:00.000Z',
  days: 41,
  applications: 54,
  interviews: 9,
  offers: 1,
  daysToOffer: 38,
} as const;

const CURRENT_SEARCH = {
  id: '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a2c',
  title: 'Мій пошук',
  status: 'active',
  outcome: null,
  startedAt: '2026-10-12T09:00:00.000Z',
  finishedAt: null,
  days: 0,
  applications: 0,
  interviews: 0,
  offers: 0,
  daysToOffer: null,
} as const;

const FINISH_BODY = {
  searchId: FINISHED_SEARCH.id,
  outcome: 'paused',
  openApplications: 'move',
} as const;

describe('finishSearchInputSchema', () => {
  it('keeps the search id, the outcome and the choice for open applications', () => {
    expect(finishSearchInputSchema.parse(FINISH_BODY)).toEqual(FINISH_BODY);
  });

  it('refuses an empty body at every required field', () => {
    expect(issuePathsOf(finishSearchInputSchema.safeParse({}))).toEqual([
      'searchId',
      'outcome',
      'openApplications',
    ]);
  });

  it.for([
    { label: 'a search id that is not a uuid', body: { searchId: '42' }, path: 'searchId' },
    { label: 'an unknown outcome', body: { outcome: 'hired' }, path: 'outcome' },
    {
      label: 'a per-application list for open applications',
      body: { openApplications: ['move'] },
      path: 'openApplications',
    },
  ])('refuses $label at $path', ({ body, path }) => {
    expect(issuePathsOf(finishSearchInputSchema.safeParse({ ...FINISH_BODY, ...body }))).toEqual([
      path,
    ]);
  });
});

describe('searchSummarySchema', () => {
  it.for([
    { label: 'a finished search with an accepted offer', summary: FINISHED_SEARCH },
    { label: 'the current search with no outcome and no offer yet', summary: CURRENT_SEARCH },
  ])('accepts $label', ({ summary }) => {
    expect(searchSummarySchema.parse(summary)).toEqual(summary);
  });

  it.for([
    { label: 'a negative application count', body: { applications: -1 }, path: 'applications' },
    { label: 'a fractional day count', body: { days: 1.5 }, path: 'days' },
    {
      label: 'an interview count beyond int32',
      body: { interviews: 2_147_483_648 },
      path: 'interviews',
    },
    { label: 'a negative days to offer', body: { daysToOffer: -1 }, path: 'daysToOffer' },
    { label: 'an unknown outcome', body: { outcome: 'hired' }, path: 'outcome' },
    {
      label: 'a finish date that is not ISO',
      body: { finishedAt: '12.10.2026' },
      path: 'finishedAt',
    },
    { label: 'an unknown status', body: { status: 'deleted' }, path: 'status' },
  ])('refuses $label at $path', ({ body, path }) => {
    expect(issuePathsOf(searchSummarySchema.safeParse({ ...FINISHED_SEARCH, ...body }))).toEqual([
      path,
    ]);
  });
});

describe('search responses', () => {
  it('accepts the history of the current and a finished search', () => {
    const history = { items: [CURRENT_SEARCH, FINISHED_SEARCH] };
    expect(searchListResponseSchema.parse(history)).toEqual(history);
  });

  it('refuses a history item with a negative offer count at items.0.offers', () => {
    const history = { items: [{ ...FINISHED_SEARCH, offers: -1 }] };
    expect(issuePathsOf(searchListResponseSchema.safeParse(history))).toEqual(['items.0.offers']);
  });

  it('accepts a finish answer with the finished and the new current search', () => {
    const answer = { finished: FINISHED_SEARCH, current: CURRENT_SEARCH };
    expect(finishSearchResponseSchema.parse(answer)).toEqual(answer);
  });

  it('refuses a finish answer without the new current search at current', () => {
    expect(
      issuePathsOf(finishSearchResponseSchema.safeParse({ finished: FINISHED_SEARCH })),
    ).toEqual(['current']);
  });
});
