import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import {
  createResumeVersionInputSchema,
  RESUME_VERSION_LIMITS,
  resumeVersionLabel,
  updateResumeVersionInputSchema,
} from './resume-version.js';

const PDF_VERSION = {
  uploadId: '01920000-0000-7000-8000-000000000060',
  filename: 'cv.pdf',
  mime: 'application/pdf',
  title: 'для продуктових',
};

describe('resumeVersionLabel', () => {
  it('labels a version with its number and custom title, as the design draws it', () => {
    expect(resumeVersionLabel({ number: 2, title: 'акцент на продукті' })).toBe(
      'CV v2 · акцент на продукті',
    );
  });
});

describe('createResumeVersionInputSchema', () => {
  it('keeps the designed limits: a 120-character title, a 2000-character note', () => {
    expect(RESUME_VERSION_LIMITS).toEqual({ titleMaxLength: 120, noteMaxLength: 2000 });
  });

  it('trims the title and accepts a version without a note', () => {
    expect(
      createResumeVersionInputSchema.parse({ ...PDF_VERSION, title: '  для аутсорсу ' }),
    ).toEqual({ ...PDF_VERSION, title: 'для аутсорсу' });
  });

  it('accepts a title of exactly 120 characters', () => {
    const title = 'н'.repeat(120);

    expect(createResumeVersionInputSchema.parse({ ...PDF_VERSION, title }).title).toBe(title);
  });

  it.for([
    {
      label: 'a 121-character title',
      input: { ...PDF_VERSION, title: 'н'.repeat(121) },
      path: 'title',
    },
    { label: 'a blank title', input: { ...PDF_VERSION, title: '   ' }, path: 'title' },
    { label: 'a blank note', input: { ...PDF_VERSION, note: '  ' }, path: 'note' },
    {
      label: 'a create without uploadId',
      input: { ...PDF_VERSION, uploadId: undefined },
      path: 'uploadId',
    },
    { label: 'a PNG', input: { ...PDF_VERSION, mime: 'image/png' }, path: 'mime' },
  ])('refuses $label at $path', ({ input, path }) => {
    expect(issuePathsOf(createResumeVersionInputSchema.safeParse(input))).toEqual([path]);
  });
});

describe('updateResumeVersionInputSchema', () => {
  it('refuses an empty patch with the hint to send a field', () => {
    expect(updateResumeVersionInputSchema.safeParse({}).error?.issues).toMatchObject([
      { path: [], message: 'Send at least one field to change' },
    ]);
  });

  it('archives a version and clears its note in one patch', () => {
    expect(updateResumeVersionInputSchema.parse({ isArchived: true, note: null })).toEqual({
      isArchived: true,
      note: null,
    });
  });
});
