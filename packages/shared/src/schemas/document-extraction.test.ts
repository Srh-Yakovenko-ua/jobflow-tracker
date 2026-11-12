import { describe, expect, it } from 'vitest';

import { documentContractJsonSchemas } from '../ai/contracts.js';
import { issuePathsOf } from '../test/zod-issues.js';
import {
  DOCUMENT_FAILURES,
  DOCUMENT_LIMITS,
  documentExtractionSchema,
} from './document-extraction.js';

const SCAN_PAGE = { index: 0, jpegBase64: '/9j/4AAQSkZJRg==', bytes: 10 };

const TEXT_BODY = { kind: 'text', text: 'Senior TypeScript developer', pages: [], pageCount: 2 };

const SCAN_BODY = {
  kind: 'scan',
  text: '',
  pages: [SCAN_PAGE, { ...SCAN_PAGE, index: 1 }, { ...SCAN_PAGE, index: 2 }],
  pageCount: 4,
};

describe('documentExtractionSchema', () => {
  it('keeps the designed limits: 10 MiB, 20 pages, 3 scan pages, 180 KiB a page', () => {
    expect(DOCUMENT_LIMITS).toEqual({
      maxBytes: 10_485_760,
      maxPages: 20,
      scanPages: 3,
      maxJpegBytes: 184_320,
    });
  });

  it.for([
    { label: 'a text body', body: TEXT_BODY },
    { label: 'a scan body with three pages', body: SCAN_BODY },
    {
      label: 'a scan page of exactly 180 KiB',
      body: { ...SCAN_BODY, pages: [{ ...SCAN_PAGE, bytes: 184_320 }] },
    },
  ])('accepts $label', ({ body }) => {
    expect(documentExtractionSchema.parse(body)).toEqual(body);
  });

  it.for([
    {
      label: 'a page of 184321 bytes',
      body: { ...SCAN_BODY, pages: [{ ...SCAN_PAGE, bytes: 184_321 }] },
      path: 'pages.0.bytes',
    },
    {
      label: 'a fourth page',
      body: { ...SCAN_BODY, pages: [...SCAN_BODY.pages, { ...SCAN_PAGE, index: 3 }] },
      path: 'pages',
    },
    { label: 'pageCount 0', body: { ...TEXT_BODY, pageCount: 0 }, path: 'pageCount' },
    { label: 'pageCount 21', body: { ...TEXT_BODY, pageCount: 21 }, path: 'pageCount' },
    { label: 'an unknown kind', body: { ...TEXT_BODY, kind: 'ocr' }, path: 'kind' },
    {
      label: 'a page index past the 20th page',
      body: { ...SCAN_BODY, pages: [{ ...SCAN_PAGE, index: 20 }] },
      path: 'pages.0.index',
    },
    {
      label: 'an empty JPEG',
      body: { ...SCAN_BODY, pages: [{ ...SCAN_PAGE, jpegBase64: '' }] },
      path: 'pages.0.jpegBase64',
    },
  ])('refuses $label at $path', ({ body, path }) => {
    expect(issuePathsOf(documentExtractionSchema.safeParse(body))).toEqual([path]);
  });
});

describe('DOCUMENT_FAILURES', () => {
  it('names the error types the document service refuses a file with', () => {
    expect(DOCUMENT_FAILURES).toEqual([
      'file_too_large',
      'unsupported_type',
      'encrypted_pdf',
      'unreadable_file',
    ]);
  });
});

describe('documentContractJsonSchemas', () => {
  it('exports the extraction response with the text and scan kinds', () => {
    expect(documentContractJsonSchemas()).toMatchObject({
      document_extraction: {
        title: 'DocumentExtraction',
        required: ['kind', 'text', 'pages', 'pageCount'],
        properties: { kind: { enum: ['text', 'scan'] } },
      },
    });
  });
});
