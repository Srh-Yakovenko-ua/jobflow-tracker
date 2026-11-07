import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import { RESUME_UPLOAD_LIMITS, resumeUploadInputSchema } from './resume-upload.js';

const PDF_UPLOAD = { filename: 'cv.pdf', mime: 'application/pdf', sizeBytes: 1024 };

describe('resumeUploadInputSchema', () => {
  it('keeps the designed limits: 5 MiB, a 10-minute upload URL, a 5-minute download URL', () => {
    expect(RESUME_UPLOAD_LIMITS).toEqual({
      maxBytes: 5_242_880,
      uploadUrlTtlSeconds: 600,
      downloadUrlTtlSeconds: 300,
      filenameMaxLength: 255,
    });
  });

  it.for([
    { label: 'a PDF of exactly 5 MiB', input: { ...PDF_UPLOAD, sizeBytes: 5_242_880 } },
    {
      label: 'a DOCX',
      input: {
        filename: 'cv.docx',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 20_480,
      },
    },
  ])('accepts $label', ({ input }) => {
    expect(resumeUploadInputSchema.parse(input)).toEqual(input);
  });

  it('trims the filename', () => {
    expect(resumeUploadInputSchema.parse({ ...PDF_UPLOAD, filename: '  cv.pdf ' }).filename).toBe(
      'cv.pdf',
    );
  });

  it.for([
    { label: 'an 8,4 MB file', input: { ...PDF_UPLOAD, sizeBytes: 8_808_038 }, path: 'sizeBytes' },
    {
      label: 'one byte over 5 MiB',
      input: { ...PDF_UPLOAD, sizeBytes: 5_242_881 },
      path: 'sizeBytes',
    },
    { label: 'an empty file', input: { ...PDF_UPLOAD, sizeBytes: 0 }, path: 'sizeBytes' },
    { label: 'a PNG', input: { ...PDF_UPLOAD, mime: 'image/png' }, path: 'mime' },
    { label: 'an .exe', input: { ...PDF_UPLOAD, mime: 'application/x-msdownload' }, path: 'mime' },
    { label: 'a blank filename', input: { ...PDF_UPLOAD, filename: '   ' }, path: 'filename' },
    {
      label: 'a 256-character filename',
      input: { ...PDF_UPLOAD, filename: `${'н'.repeat(252)}.pdf` },
      path: 'filename',
    },
  ])('refuses $label at $path', ({ input, path }) => {
    expect(issuePathsOf(resumeUploadInputSchema.safeParse(input))).toEqual([path]);
  });
});
