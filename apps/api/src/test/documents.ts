import type { DocumentExtraction } from '@jobflow/shared';

import type { DocumentsExtract } from '../modules/resumes/index.js';

export const RESUME_TEXT =
  'Jane Doe\nFrontend developer at Acme, 2021-03 to now\nReact, TypeScript\nEnglish B2';

export const SCAN_PAGE_JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U';

export const TEXT_EXTRACTION: DocumentExtraction = {
  kind: 'text',
  text: RESUME_TEXT,
  pages: [],
  pageCount: 2,
};

export const SCAN_EXTRACTION: DocumentExtraction = {
  kind: 'scan',
  text: '',
  pages: [{ index: 0, jpegBase64: SCAN_PAGE_JPEG, bytes: 51 }],
  pageCount: 1,
};

export class FakeDocumentsClient {
  readonly calls: DocumentsExtract[] = [];

  answer: () => Promise<DocumentExtraction> = () => Promise.resolve(TEXT_EXTRACTION);

  extract(request: DocumentsExtract): Promise<DocumentExtraction> {
    this.calls.push(request);
    return this.answer();
  }
}
