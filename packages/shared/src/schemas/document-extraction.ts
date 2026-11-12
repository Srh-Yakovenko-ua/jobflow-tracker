import { z } from 'zod';

export const DOCUMENT_KINDS = ['text', 'scan'] as const;

export const documentKindSchema = z.enum(DOCUMENT_KINDS);

export const DOCUMENT_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxPages: 20,
  scanPages: 3,
  maxJpegBytes: 180 * 1024,
} as const;

export const DOCUMENT_FAILURES = [
  'file_too_large',
  'unsupported_type',
  'encrypted_pdf',
  'unreadable_file',
] as const;

export const documentPageSchema = z.object({
  index: z
    .int()
    .min(0)
    .max(DOCUMENT_LIMITS.maxPages - 1),
  jpegBase64: z
    .string()
    .min(1)
    .max(Math.ceil(DOCUMENT_LIMITS.maxJpegBytes / 3) * 4),
  bytes: z.int().positive().max(DOCUMENT_LIMITS.maxJpegBytes),
});

export const documentExtractionSchema = z.object({
  kind: documentKindSchema,
  text: z.string(),
  pages: z.array(documentPageSchema).max(DOCUMENT_LIMITS.scanPages),
  pageCount: z.int().min(1).max(DOCUMENT_LIMITS.maxPages),
});

export type DocumentKind = z.infer<typeof documentKindSchema>;
export type DocumentPage = z.infer<typeof documentPageSchema>;
export type DocumentExtraction = z.infer<typeof documentExtractionSchema>;
