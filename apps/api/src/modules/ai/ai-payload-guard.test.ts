import { describe, expect, it } from 'vitest';

import { PRIVATE_NOTE, RECRUITER_CHANNELS, VACANCY_TEXT } from '../../test/ai.js';
import { privatePayloadPaths } from './ai-payload-guard.js';

const text = VACANCY_TEXT;

describe('privatePayloadPaths', () => {
  it.each([
    { payload: 'the vacancy text alone', input: { text }, paths: [] },
    { payload: 'a note body beside the text', input: { text, ...PRIVATE_NOTE }, paths: ['body'] },
    {
      payload: 'the notes of the application',
      input: { text, notes: [PRIVATE_NOTE] },
      paths: ['notes'],
    },
    {
      payload: 'a recruiter email in the contacts',
      input: { text, contacts: [{ email: RECRUITER_CHANNELS.email }] },
      paths: ['contacts'],
    },
    {
      payload: 'recruiter channels inside a list under another key',
      input: { text, people: [{ name: 'Ірина', ...RECRUITER_CHANNELS }] },
      paths: ['people.0.email', 'people.0.phone', 'people.0.telegram'],
    },
    {
      payload: 'one note nested in an object',
      input: { text, extra: { note: PRIVATE_NOTE.body } },
      paths: ['extra.note'],
    },
  ])('finds $payload at $paths and never returns a value', ({ input, paths }) => {
    expect(privatePayloadPaths(input)).toEqual(paths);
  });

  it.each([null, 'a note', 42, [text]])('finds nothing in the non-object input %j', (input) => {
    expect(privatePayloadPaths(input)).toEqual([]);
  });
});
