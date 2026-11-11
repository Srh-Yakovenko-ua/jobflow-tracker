import { RESUME_UPLOAD_LIMITS } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { checkResumeFile, defaultTitleOf } from './resume-file';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const MEBIBYTE = 1024 * 1024;

function fileOf({ name, type, size }: { name: string; type: string; size: number }): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('checkResumeFile', () => {
  it.each([
    { name: 'andrii_cv.pdf', type: 'application/pdf', mime: 'application/pdf' },
    { name: 'andrii_cv.docx', type: DOCX, mime: DOCX },
    { name: 'andrii_cv.docx', type: '', mime: DOCX },
    { name: 'ANDRII_CV.PDF', type: 'application/octet-stream', mime: 'application/pdf' },
  ])('$name typed "$type" is sent as $mime', ({ name, type, mime }) => {
    expect(checkResumeFile(fileOf({ name, type, size: 2048 }))).toEqual({
      kind: 'ok',
      input: { filename: name, mime, sizeBytes: 2048 },
    });
  });

  it('a 6 MiB PDF is refused as too big with its size and the 5 MiB limit', () => {
    const file = fileOf({ name: 'cv.pdf', type: 'application/pdf', size: 6 * MEBIBYTE });

    expect(checkResumeFile(file)).toEqual({
      kind: 'tooBig',
      file: { sizeBytes: 6 * MEBIBYTE, limitBytes: RESUME_UPLOAD_LIMITS.maxBytes },
    });
  });

  it('a PDF of exactly 5 MiB still passes', () => {
    const file = fileOf({ name: 'cv.pdf', type: 'application/pdf', size: 5 * MEBIBYTE });

    expect(checkResumeFile(file).kind).toBe('ok');
  });

  it('a big PNG is refused as an unsupported type, not as a size problem', () => {
    const file = fileOf({ name: 'scan.png', type: 'image/png', size: 6 * MEBIBYTE });

    expect(checkResumeFile(file)).toEqual({ kind: 'unsupported' });
  });

  it('an empty PDF is refused as unreadable', () => {
    expect(checkResumeFile(fileOf({ name: 'cv.pdf', type: 'application/pdf', size: 0 }))).toEqual({
      kind: 'unreadable',
    });
  });
});

describe('defaultTitleOf', () => {
  it.each([
    { filename: 'andrii_cv_v2.pdf', title: 'andrii_cv_v2' },
    { filename: '  cv.for.product.docx ', title: 'cv.for.product' },
    { filename: '.pdf', title: '.pdf' },
    { filename: `${'а'.repeat(130)}.pdf`, title: 'а'.repeat(120) },
  ])('names $filename as "$title"', ({ filename, title }) => {
    expect(defaultTitleOf(filename)).toBe(title);
  });
});
