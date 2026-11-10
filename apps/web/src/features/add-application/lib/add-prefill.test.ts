import { describe, expect, it } from 'vitest';

import { addPrefillOf } from './add-prefill';

const BLANK = { text: '', url: '', focusPaste: false };

const TEXT_LIMIT = 20_000;

describe('addPrefillOf', () => {
  it('a visit with no query prefills nothing and leaves focus alone', () => {
    expect(addPrefillOf({})).toEqual(BLANK);
  });

  it('the bookmarklet fallback fills the text and its http url and asks for focus', () => {
    const query = { text: 'Senior QA\n\nKvit Software шукає', url: 'https://djinni.co/jobs/1' };

    expect(addPrefillOf(query)).toEqual({ ...query, focusPaste: true });
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://files.example.com/vacancy',
    '//djinni.co/jobs/1',
    'djinni.co/jobs/1',
    '',
  ])('drops the url %j', (url) => {
    expect(addPrefillOf({ url })).toEqual(BLANK);
  });

  it('ignores a text or url sent more than once', () => {
    const query = { text: ['one', 'two'], url: ['https://a.example', 'https://b.example'] };

    expect(addPrefillOf(query)).toEqual(BLANK);
  });

  it('cuts a text over the parse limit to 20 000 characters', () => {
    const { text } = addPrefillOf({ text: 'я'.repeat(TEXT_LIMIT + 5) });

    expect(text).toBe('я'.repeat(TEXT_LIMIT));
  });

  it('path=paste asks for focus in the paste form with nothing prefilled', () => {
    expect(addPrefillOf({ path: 'paste' })).toEqual({ ...BLANK, focusPaste: true });
  });

  it.each(['manual', ['paste', 'paste']])('path %j leaves focus alone', (path) => {
    expect(addPrefillOf({ path })).toEqual(BLANK);
  });
});
