import { describe, expect, it } from 'vitest';

import {
  applicationCursorSchema,
  applicationListRequestSchema,
  encodeApplicationCursor,
} from './application-cursor.js';

const LAST_EVENT_AT = new Date('2026-10-21T14:05:09.123Z');

const APPLICATION_ID = '0199f1b0-4c5d-7e6f-8a7b-9c0d1e2f3a4b';

const base64urlOf = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

const issuesOf = (value: unknown) =>
  applicationCursorSchema
    .safeParse(value)
    .error?.issues.map(({ code, message }) => ({ code, message })) ?? [];

const INVALID_CURSOR = [{ code: 'custom', message: 'invalid cursor' }];

describe('the application cursor', () => {
  it('reads back the lastEventAt and id it was written from', () => {
    const cursor = encodeApplicationCursor({ lastEventAt: LAST_EVENT_AT, id: APPLICATION_ID });

    expect(cursor).toMatch(/^[\w-]+$/);
    expect(applicationCursorSchema.parse(cursor)).toEqual({
      lastEventAt: LAST_EVENT_AT,
      id: APPLICATION_ID,
    });
  });

  it.each([
    { case: 'garbage', value: 'not a cursor!' },
    { case: 'an empty string', value: '' },
    { case: 'base64url of a non-JSON text', value: Buffer.from('{[').toString('base64url') },
    {
      case: 'base64url of an object instead of the tuple',
      value: base64urlOf({ lastEventAt: LAST_EVENT_AT.toISOString(), id: APPLICATION_ID }),
    },
    {
      case: 'base64url of a tuple with a date that is not ISO',
      value: base64urlOf(['yesterday', APPLICATION_ID]),
    },
    {
      case: 'base64url of a tuple with an id that is not a uuid',
      value: base64urlOf([LAST_EVENT_AT.toISOString(), '42']),
    },
    {
      case: 'base64url of a tuple with a third item',
      value: base64urlOf([LAST_EVENT_AT.toISOString(), APPLICATION_ID, 'x']),
    },
    {
      case: 'base64url of a tuple dated in year 0000, before the timestamptz range',
      value: base64urlOf(['0000-01-01T00:00:00Z', APPLICATION_ID]),
    },
  ])('refuses $case as an invalid cursor', ({ value }) => {
    expect(issuesOf(value)).toEqual(INVALID_CURSOR);
  });

  it('refuses a cursor past 200 characters before decoding it', () => {
    expect(issuesOf('a'.repeat(201))).toEqual([
      { code: 'too_big', message: 'Too big: expected string to have <=200 characters' },
    ]);
  });

  it('reports an invalid cursor in the list query at path cursor', () => {
    const paths = applicationListRequestSchema
      .safeParse({ cursor: 'not a cursor!' })
      .error?.issues.map(({ path }) => path.join('.'));

    expect(paths).toEqual(['cursor']);
  });

  it('hands the decoded cursor to the list query next to its defaults', () => {
    const cursor = encodeApplicationCursor({ lastEventAt: LAST_EVENT_AT, id: APPLICATION_ID });

    expect(applicationListRequestSchema.parse({ cursor })).toEqual({
      sort: '-lastEventAt',
      limit: 50,
      cursor: { lastEventAt: LAST_EVENT_AT, id: APPLICATION_ID },
    });
  });
});
