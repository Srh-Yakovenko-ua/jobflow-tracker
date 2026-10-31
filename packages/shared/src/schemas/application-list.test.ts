import { describe, expect, it } from 'vitest';

import { type Stage, STAGES } from '../stages.js';
import { issuePathsOf } from '../test/zod-issues.js';
import {
  applicationBoardQuerySchema,
  applicationBoardResponseSchema,
  type ApplicationCard,
  applicationCardSchema,
  applicationListItemSchema,
  applicationListQuerySchema,
} from './application-list.js';

const SEARCH_ID = '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a2b';

const CARD = {
  id: '0199f1a2-4d5e-7f60-9b7c-8d9e0f1a2b3c',
  company: 'Смерека Софт',
  position: 'Backend engineer',
  source: 'dou',
  salaryMin: null,
  salaryMax: null,
  currency: null,
  matchScore: 81,
  currentStage: 'screening',
  isDraft: false,
  appliedAt: '2026-10-16T09:30:00.000Z',
  lastEventAt: '2026-10-19T14:00:00.000Z',
  daysInStage: 3,
  daysSinceLastEvent: 3,
  silenceLevel: 'none',
  stack: ['Go', 'Kafka', 'Redis'],
  stackCount: 5,
  nextScheduledEvent: { kind: 'screening_call', startsAt: '2026-10-22T13:00:00.000Z' },
  aiStatus: 'done',
} satisfies ApplicationCard;

const columnsOf = (stages: readonly Stage[]) =>
  Object.fromEntries(stages.map((stage) => [stage, { count: 0, items: [] }]));

describe('applicationListQuerySchema', () => {
  it('fills sort -lastEventAt and limit 50 for an empty query', () => {
    expect(applicationListQuerySchema.parse({})).toEqual({ sort: '-lastEventAt', limit: 50 });
  });

  it('trims each comma-separated stage and drops the empty ones', () => {
    expect(applicationListQuerySchema.parse({ stage: ' applied, ,screening,' }).stage).toEqual([
      'applied',
      'screening',
    ]);
  });

  it('keeps every filter it knows', () => {
    const query = {
      source: 'djinni,dou',
      q: '  Смерека ',
      hasScore: 'false',
      silence: 'warn,silent',
      sort: 'lastEventAt',
      limit: '20',
      cursor: 'opaque',
      searchId: SEARCH_ID,
    };
    expect(applicationListQuerySchema.parse(query)).toEqual({
      source: ['djinni', 'dou'],
      q: 'Смерека',
      hasScore: false,
      silence: ['warn', 'silent'],
      sort: 'lastEventAt',
      limit: 20,
      cursor: 'opaque',
      searchId: SEARCH_ID,
    });
  });

  it('reads hasScore true as true', () => {
    expect(applicationListQuerySchema.parse({ hasScore: 'true' }).hasScore).toBe(true);
  });

  it('accepts sort relevance when q is given', () => {
    expect(applicationListQuerySchema.parse({ q: 'kafka', sort: 'relevance' })).toEqual({
      q: 'kafka',
      sort: 'relevance',
      limit: 50,
    });
  });

  it.for([
    { label: 'an unknown second stage', query: { stage: 'applied,hired' }, path: 'stage.1' },
    { label: 'a stage list of commas only', query: { stage: ' , ,' }, path: 'stage' },
    { label: 'an unknown source', query: { source: 'indeed' }, path: 'source.0' },
    { label: 'an unknown silence level', query: { silence: 'loud' }, path: 'silence.0' },
    { label: 'hasScore 1', query: { hasScore: '1' }, path: 'hasScore' },
    { label: 'hasScore yes', query: { hasScore: 'yes' }, path: 'hasScore' },
    { label: 'hasScore TRUE', query: { hasScore: 'TRUE' }, path: 'hasScore' },
    { label: 'a blank q', query: { q: '   ' }, path: 'q' },
    { label: 'a q past 200 characters', query: { q: 'q'.repeat(201) }, path: 'q' },
    { label: 'a q with a NUL character', query: { q: 'a\u0000b' }, path: 'q' },
    { label: 'a sort by createdAt', query: { sort: 'createdAt' }, path: 'sort' },
    { label: 'sort relevance without q', query: { sort: 'relevance' }, path: 'sort' },
    { label: 'limit 0', query: { limit: '0' }, path: 'limit' },
    { label: 'limit 101', query: { limit: '101' }, path: 'limit' },
    { label: 'a searchId that is not a uuid', query: { searchId: '42' }, path: 'searchId' },
  ])('refuses $label at $path', ({ query, path }) => {
    expect(issuePathsOf(applicationListQuerySchema.safeParse(query))).toEqual([path]);
  });
});

describe('applicationBoardQuerySchema', () => {
  it('accepts expand rejected,ghosted', () => {
    expect(applicationBoardQuerySchema.parse({ expand: 'rejected,ghosted' })).toEqual({
      expand: ['rejected', 'ghosted'],
    });
  });

  it('strips stage, sort, limit, cursor and searchId', () => {
    const listOnly = { stage: 'applied', sort: 'lastEventAt', limit: '5', cursor: 'x' };
    expect(applicationBoardQuerySchema.parse({ ...listOnly, searchId: SEARCH_ID })).toEqual({});
  });

  it.for(['offer', 'applied'])('refuses expand %s, which is not an outcome', (expand) => {
    expect(issuePathsOf(applicationBoardQuerySchema.safeParse({ expand }))).toEqual(['expand.0']);
  });
});

describe('applicationCardSchema', () => {
  it('accepts a card with three stack items, no salary, no applied date and no AI job', () => {
    const card = { ...CARD, appliedAt: null, aiStatus: null, nextScheduledEvent: null };
    expect(applicationCardSchema.parse(card)).toEqual(card);
  });

  it('refuses a fourth stack item', () => {
    const card = { ...CARD, stack: [...CARD.stack, 'gRPC'] };
    expect(issuePathsOf(applicationCardSchema.safeParse(card))).toEqual(['stack']);
  });
});

describe('applicationListItemSchema', () => {
  it('accepts a card with a snippet split into plain and matched parts', () => {
    const snippet = [
      { text: 'Черги на ', match: false },
      { text: 'Kafka', match: true },
    ];
    expect(applicationListItemSchema.parse({ ...CARD, snippet })).toEqual({ ...CARD, snippet });
  });

  it('refuses an empty snippet, which must be null instead', () => {
    expect(issuePathsOf(applicationListItemSchema.safeParse({ ...CARD, snippet: [] }))).toEqual([
      'snippet',
    ]);
  });
});

describe('applicationBoardResponseSchema', () => {
  it('accepts every stage with outcomes collapsed to a count', () => {
    const columns = { ...columnsOf(STAGES), screening: { count: 1, items: [CARD] } };
    const board = { columns: { ...columns, rejected: { count: 4, items: null } } };
    expect(applicationBoardResponseSchema.parse(board)).toEqual(board);
  });

  it('refuses a board without the withdrawn column', () => {
    const columns = columnsOf(STAGES.filter((stage) => stage !== 'withdrawn'));
    expect(issuePathsOf(applicationBoardResponseSchema.safeParse({ columns }))).toEqual([
      'columns.withdrawn',
    ]);
  });
});
