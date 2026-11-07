import { describe, expect, it } from 'vitest';

import { keyOf, requestHashOf } from './idempotency-request.js';

const NOTES_URL = '/api/v1/applications/0199f0c4-6e3f-7c42-9d50-7b8c9d0e1f2a/notes';

const NOTE_POST = { method: 'POST', originalUrl: NOTES_URL, body: { body: 'Перша нотатка' } };

const KEY = '0199f3a0-1b2c-7d3e-8f40-5a6b7c8d9e0f';

const keyedWith = (key: string) => ({ headers: { 'idempotency-key': key } });

function refusalOf(key: string): unknown {
  try {
    keyOf(keyedWith(key));
    return undefined;
  } catch (error: unknown) {
    return error;
  }
}

describe('requestHashOf', () => {
  it('gives one sha256 hex for the same method, path and body', () => {
    const hash = requestHashOf(NOTE_POST);

    expect(requestHashOf({ ...NOTE_POST, body: { body: 'Перша нотатка' } })).toBe(hash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    { case: 'another body', change: { body: { body: 'Друга нотатка' } } },
    { case: 'another path', change: { originalUrl: NOTES_URL.replace('notes', 'contacts') } },
    { case: 'another method', change: { method: 'PATCH' } },
    { case: 'no body', change: { body: undefined } },
  ])('gives another hash for $case', ({ change }) => {
    expect(requestHashOf({ ...NOTE_POST, ...change })).not.toBe(requestHashOf(NOTE_POST));
  });
});

describe('keyOf', () => {
  it('reads the key from the Idempotency-Key header', () => {
    expect(keyOf(keyedWith(KEY))).toBe(KEY);
  });

  it('accepts a key of exactly 255 characters', () => {
    expect(keyOf(keyedWith('k'.repeat(255)))).toHaveLength(255);
  });

  it('leaves a request without the header unkeyed', () => {
    expect(keyOf({ headers: {} })).toBeUndefined();
  });

  it.each([
    { case: 'an empty key', key: '' },
    { case: 'a key of 256 characters', key: 'k'.repeat(256) },
  ])('refuses $case with 422 at Idempotency-Key', ({ key }) => {
    expect(refusalOf(key)).toMatchObject({
      body: { status: 422, type: 'validation_error', errors: [{ path: 'Idempotency-Key' }] },
    });
  });
});
