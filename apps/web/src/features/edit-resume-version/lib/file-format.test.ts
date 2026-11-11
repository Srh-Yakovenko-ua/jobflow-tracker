import { describe, expect, it } from 'vitest';

import { fileFormatOf } from './file-format';

describe('fileFormatOf', () => {
  it.each([
    { mime: 'application/pdf', filename: 'andrii_cv.pdf', format: 'PDF' },
    {
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      filename: 'andrii_cv.docx',
      format: 'DOCX',
    },
    { mime: 'application/rtf', filename: 'andrii_cv.rtf', format: 'RTF' },
  ])('a $mime version is labelled $format', ({ mime, filename, format }) => {
    expect(fileFormatOf({ mime, filename })).toBe(format);
  });
});
