import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import {
  CAPTURE_BOOKMARKLET_LIMITS,
  captureBookmarkletInputSchema,
  capturePasteInputSchema,
  captureTokenCreatedSchema,
  captureTokenListResponseSchema,
} from './capture.js';

const text = 'Senior Frontend Engineer у Grammarly\nReact, TypeScript\n';

describe('capturePasteInputSchema', () => {
  it.each([
    { label: 'the pasted text alone', input: { text } },
    {
      label: 'the pasted text with an https url',
      input: { text, url: 'https://djinni.co/jobs/1' },
    },
    { label: 'the pasted text with a null url', input: { text, url: null } },
    { label: 'a text of exactly 20 000 characters', input: { text: 'н'.repeat(20_000) } },
  ])('accepts $label unchanged', ({ input }) => {
    expect(capturePasteInputSchema.parse(input)).toEqual(input);
  });

  it.each([
    { label: 'a missing text', input: {}, path: 'text' },
    { label: 'a blank text', input: { text: '  \n\t' }, path: 'text' },
    { label: 'a text of 20 001 characters', input: { text: 'н'.repeat(20_001) }, path: 'text' },
    { label: 'a javascript: url', input: { text, url: 'javascript:alert(1)' }, path: 'url' },
    { label: 'an ftp url', input: { text, url: 'ftp://djinni.co/jobs/1' }, path: 'url' },
    {
      label: 'a url longer than 2048 characters',
      input: { text, url: `https://djinni.co/${'a'.repeat(2048)}` },
      path: 'url',
    },
  ])('refuses $label at $path', ({ input, path }) => {
    expect(issuePathsOf(capturePasteInputSchema.safeParse(input))).toEqual([path]);
  });
});

const page = {
  url: 'https://djinni.co/jobs/1',
  title: 'Senior Frontend Engineer у Grammarly',
  text,
};

describe('captureBookmarkletInputSchema', () => {
  it.each([
    { label: 'the url, the title and the page text', input: page },
    { label: 'the page with its html', input: { ...page, html: `<main><p>${text}</p></main>` } },
    { label: 'a title of exactly 300 characters', input: { ...page, title: 'н'.repeat(300) } },
    {
      label: 'a text of exactly 300 000 characters',
      input: { ...page, text: 'н'.repeat(300_000) },
    },
  ])('accepts $label unchanged', ({ input }) => {
    expect(captureBookmarkletInputSchema.parse(input)).toEqual(input);
  });

  it('trims the title and leaves the text as the page sent it', () => {
    expect(captureBookmarkletInputSchema.parse({ ...page, title: `  ${page.title}\n` })).toEqual(
      page,
    );
  });

  it.each([
    { label: 'a missing url', patch: { url: undefined }, path: 'url' },
    { label: 'a null url', patch: { url: null }, path: 'url' },
    { label: 'an ftp url', patch: { url: 'ftp://djinni.co/jobs/1' }, path: 'url' },
    { label: 'a blank title', patch: { title: ' \t' }, path: 'title' },
    { label: 'a title of 301 characters', patch: { title: 'н'.repeat(301) }, path: 'title' },
    { label: 'a blank text', patch: { text: '  \n\t' }, path: 'text' },
    { label: 'a text with a NUL character', patch: { text: `${text}\u0000` }, path: 'text' },
    { label: 'an html with a NUL character', patch: { html: '<p>\u0000</p>' }, path: 'html' },
    { label: 'a text of 300 001 characters', patch: { text: 'н'.repeat(300_001) }, path: 'text' },
  ])('refuses $label at $path', ({ patch, path }) => {
    expect(issuePathsOf(captureBookmarkletInputSchema.safeParse({ ...page, ...patch }))).toEqual([
      path,
    ]);
  });

  it('caps the request body at 300 KB', () => {
    expect(CAPTURE_BOOKMARKLET_LIMITS.bodyMaxBytes).toBe(307_200);
  });
});

const issued = {
  id: '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a2b',
  createdAt: '2026-11-10T09:00:00.000Z',
};

describe('captureTokenCreatedSchema', () => {
  const created = { ...issued, token: 'Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4' };

  it('accepts the id, the token and the creation time', () => {
    expect(captureTokenCreatedSchema.parse(created)).toEqual(created);
  });

  it('refuses an empty token at token', () => {
    expect(issuePathsOf(captureTokenCreatedSchema.safeParse({ ...created, token: '' }))).toEqual([
      'token',
    ]);
  });
});

describe('captureTokenListResponseSchema', () => {
  it.each([
    { label: 'an empty list', items: [] },
    { label: 'a capture token never used', items: [{ ...issued, lastUsedAt: null }] },
    {
      label: 'a capture token with its last used time',
      items: [{ ...issued, lastUsedAt: '2026-11-10T09:05:00.000Z' }],
    },
  ])('accepts $label unchanged', ({ items }) => {
    expect(captureTokenListResponseSchema.parse({ items })).toEqual({ items });
  });

  it('refuses a last used time that is not an ISO time at items.0.lastUsedAt', () => {
    const items = [{ ...issued, lastUsedAt: '10.11.2026 09:05' }];

    expect(issuePathsOf(captureTokenListResponseSchema.safeParse({ items }))).toEqual([
      'items.0.lastUsedAt',
    ]);
  });
});
