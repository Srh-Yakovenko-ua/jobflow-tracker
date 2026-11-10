import { describe, expect, it } from 'vitest';

import { JOB_ID } from '@/test/job-fixtures';

import { addPrefillOf } from './add-prefill';

const BLANK = { text: '', url: '', focusPaste: false, reviewId: null, jobId: null };

const DRAFT_ID = '0b6f3c1e-5d2a-4c8e-9f10-000000000301';

const TEXT_LIMIT = 20_000;

describe('addPrefillOf', () => {
  it('a visit with no query prefills nothing and leaves focus alone', () => {
    expect(addPrefillOf({})).toEqual(BLANK);
  });

  it('the bookmarklet fallback fills the text and its http url and asks for focus', () => {
    const query = { text: 'Senior QA\n\nKvit Software шукає', url: 'https://djinni.co/jobs/1' };

    expect(addPrefillOf(query)).toEqual({ ...BLANK, ...query, focusPaste: true });
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

  it('review=<application id> names the draft to review', () => {
    expect(addPrefillOf({ review: DRAFT_ID })).toEqual({ ...BLANK, reviewId: DRAFT_ID });
  });

  it('a draft under review keeps the focus out of the paste form, whatever else the query asks', () => {
    const query = { review: DRAFT_ID, path: 'paste', text: 'Kvit шукає QA' };

    expect(addPrefillOf(query)).toMatchObject({ focusPaste: false, reviewId: DRAFT_ID });
  });

  it.each(['garbage', '', '301', [DRAFT_ID, DRAFT_ID]])('review %j names no draft', (review) => {
    expect(addPrefillOf({ review })).toEqual(BLANK);
  });

  it('job=<job id> beside review names the parse job of that draft', () => {
    expect(addPrefillOf({ review: DRAFT_ID, job: JOB_ID })).toEqual({
      ...BLANK,
      reviewId: DRAFT_ID,
      jobId: JOB_ID,
    });
  });

  it.each(['garbage', '', '77', [JOB_ID, JOB_ID]])('job %j names no job', (job) => {
    expect(addPrefillOf({ review: DRAFT_ID, job })).toEqual({ ...BLANK, reviewId: DRAFT_ID });
  });
});
