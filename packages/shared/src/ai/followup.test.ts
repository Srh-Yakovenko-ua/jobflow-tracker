import { describe, expect, it } from 'vitest';

import { buildFollowupInput, buildFollowupOutput } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { FOLLOWUP_LIMITS, followupInputSchema, followupOutputSchema } from './followup.js';

const PRIVATE_KEYS = ['body', 'note', 'notes', 'contacts', 'email', 'phone', 'telegram'];

describe('followupInputSchema', () => {
  it('keeps the designed limits: a 300-character hint, 60 to 120 words, 0.9 for another variant', () => {
    expect(FOLLOWUP_LIMITS).toEqual({
      hintMaxLength: 300,
      recruiterNameMaxLength: 60,
      subjectMaxLength: 120,
      bodyMaxLength: 1200,
      wordsMin: 60,
      wordsMax: 120,
      variantTemperature: 0.9,
    });
  });

  it('names no input field the AI-04 guard refuses', () => {
    const keys: readonly string[] = followupInputSchema.keyof().options;
    expect(keys.filter((key) => PRIVATE_KEYS.includes(key))).toEqual([]);
  });

  it.for([
    { label: 'the design example with a hint', patch: {} },
    {
      label: 'no recruiter, no interview, no signature and no hint',
      patch: { recruiterFirstName: null, lastInterview: null, senderName: null, hint: null },
    },
    {
      label: 'a 300-character hint and a 60-character recruiter name on the day of the last event',
      patch: { hint: 'з'.repeat(300), recruiterFirstName: 'О'.repeat(60), silenceDays: 0 },
    },
  ])('accepts $label', ({ patch }) => {
    const input = buildFollowupInput(patch);
    expect(followupInputSchema.parse(input)).toEqual(input);
  });

  it.for([
    { label: 'negative days of silence', patch: { silenceDays: -1 }, path: 'silenceDays' },
    { label: 'fractional days of silence', patch: { silenceDays: 1.5 }, path: 'silenceDays' },
    { label: 'a blank hint', patch: { hint: ' \n' }, path: 'hint' },
    { label: 'a 301-character hint', patch: { hint: 'з'.repeat(301) }, path: 'hint' },
    {
      label: 'a 61-character recruiter name',
      patch: { recruiterFirstName: 'О'.repeat(61) },
      path: 'recruiterFirstName',
    },
    { label: 'a Russian language', patch: { language: 'ru' }, path: 'language' },
    { label: 'an unknown tone', patch: { tone: 'pushy' }, path: 'tone' },
    {
      label: 'a last interview date with a time',
      patch: { lastInterview: { kind: 'tech_interview', date: '2026-09-03T10:00:00Z' } },
      path: 'lastInterview.date',
    },
    {
      label: 'a last interview of an unknown kind',
      patch: { lastInterview: { kind: 'coffee', date: '2026-09-03' } },
      path: 'lastInterview.kind',
    },
    { label: 'an unknown stage', patch: { stage: 'interview' }, path: 'stage' },
  ])('refuses $label at $path', ({ patch, path }) => {
    const result = followupInputSchema.safeParse({ ...buildFollowupInput(), ...patch });
    expect(issuePathsOf(result)).toEqual([path]);
  });
});

describe('followupOutputSchema', () => {
  it('accepts a subject and a body', () => {
    const output = buildFollowupOutput();
    expect(followupOutputSchema.parse(output)).toEqual(output);
  });

  it.for([
    { label: 'an empty subject', patch: { subject: '' }, path: 'subject' },
    { label: 'a 121-character subject', patch: { subject: 'т'.repeat(121) }, path: 'subject' },
    { label: 'an empty body', patch: { body: '' }, path: 'body' },
    { label: 'a 1201-character body', patch: { body: 'т'.repeat(1201) }, path: 'body' },
  ])('refuses $label at $path', ({ patch, path }) => {
    const result = followupOutputSchema.safeParse({ ...buildFollowupOutput(), ...patch });
    expect(issuePathsOf(result)).toEqual([path]);
  });
});
