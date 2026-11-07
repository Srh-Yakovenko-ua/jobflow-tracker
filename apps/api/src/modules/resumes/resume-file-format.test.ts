import { describe, expect, it } from 'vitest';

import { detectResumeFormat } from './resume-file-format.js';

describe('detectResumeFormat', () => {
  it.each([
    {
      case: 'a PDF from its %PDF- signature',
      bytes: [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37],
      format: 'application/pdf',
    },
    {
      case: 'a DOCX from its PK zip signature',
      bytes: [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00],
      format: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
    {
      case: 'nothing in a Windows executable',
      bytes: [0x4d, 0x5a, 0x90, 0x00, 0x03],
      format: null,
    },
    { case: 'nothing in an empty file', bytes: [], format: null },
    {
      case: 'nothing in a file shorter than the signature',
      bytes: [0x25, 0x50, 0x44],
      format: null,
    },
  ])('finds $case', ({ bytes, format }) => {
    expect(detectResumeFormat(Uint8Array.from(bytes))).toBe(format);
  });
});
