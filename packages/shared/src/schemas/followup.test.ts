import { describe, expect, it } from 'vitest';

import { buildFollowupOutput } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { followupRequestSchema, followupResponseSchema } from './followup.js';

const REQUEST = { tone: 'warm', language: 'uk' };

const DRAFT = { ...buildFollowupOutput(), generatedAt: '2026-09-09T10:00:00.000Z' };

const FAILED_JOB = {
  id: '01920000-0000-7000-8000-000000000080',
  status: 'failed',
  errorType: 'ai_timeout',
};

const RESPONSE = { draft: DRAFT, job: null, language: 'uk', silenceDays: 6 };

describe('followupRequestSchema', () => {
  it('asks for the first draft when variant is not sent', () => {
    expect(followupRequestSchema.parse(REQUEST)).toEqual({ ...REQUEST, variant: false });
  });

  it('trims the hint', () => {
    expect(followupRequestSchema.parse({ ...REQUEST, hint: '  дорозв’язав задачу \n' })).toEqual({
      ...REQUEST,
      hint: 'дорозв’язав задачу',
      variant: false,
    });
  });

  it.for([
    { label: 'an empty hint', hint: '' },
    { label: 'a blank hint', hint: ' \n ' },
  ])('drops $label', ({ hint }) => {
    expect(followupRequestSchema.parse({ ...REQUEST, hint, variant: true })).toStrictEqual({
      ...REQUEST,
      variant: true,
    });
  });

  it.for([
    { label: 'a 301-character hint', patch: { hint: 'з'.repeat(301) }, path: 'hint' },
    { label: 'a hint with a NUL character', patch: { hint: 'a\u0000b' }, path: 'hint' },
    { label: 'an unknown tone', patch: { tone: 'pushy' }, path: 'tone' },
    { label: 'a Russian language', patch: { language: 'ru' }, path: 'language' },
    { label: 'a variant sent as a string', patch: { variant: 'true' }, path: 'variant' },
  ])('refuses $label at $path', ({ patch, path }) => {
    expect(issuePathsOf(followupRequestSchema.safeParse({ ...REQUEST, ...patch }))).toEqual([path]);
  });
});

describe('followupResponseSchema', () => {
  it.for([
    { label: 'no draft and no job yet', body: { ...RESPONSE, draft: null } },
    { label: 'a draft beside a failed variant job', body: { ...RESPONSE, job: FAILED_JOB } },
    { label: 'a ready draft', body: RESPONSE },
  ])('accepts $label', ({ body }) => {
    expect(followupResponseSchema.parse(body)).toEqual(body);
  });

  it.for([
    {
      label: 'a draft without its generation time',
      body: { ...RESPONSE, draft: buildFollowupOutput() },
      path: 'draft.generatedAt',
    },
    {
      label: 'a job without its error type',
      body: { ...RESPONSE, job: { id: FAILED_JOB.id, status: 'failed' } },
      path: 'job.errorType',
    },
    {
      label: 'negative days of silence',
      body: { ...RESPONSE, silenceDays: -1 },
      path: 'silenceDays',
    },
  ])('refuses $label at $path', ({ body, path }) => {
    expect(issuePathsOf(followupResponseSchema.safeParse(body))).toEqual([path]);
  });
});
