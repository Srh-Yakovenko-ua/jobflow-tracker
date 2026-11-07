import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  type ConfirmedResumeUpload,
  confirmedResumeUploadSchema,
  type ConfirmResumeUploadInput,
  confirmResumeUploadInputSchema,
  RESUME_UPLOAD_LIMITS,
  type ResumeUploadInput,
  resumeUploadInputSchema,
  type ResumeUploadTicket,
  resumeUploadTicketSchema,
  uploadIdSchema,
} from '@jobflow/shared';
import { z } from 'zod';

import { errorResponses, jsonContent } from '../../openapi/route.js';

const UPLOADS_PATH = '/uploads/resume';

const TAGS = ['resumes'];

const EXAMPLE_UPLOAD_ID = '6f1c2b9e-3d4a-4f5b-8c6d-7e8f9a0b1c2d';

const uploadIdParams = z.object({ uploadId: uploadIdSchema.meta({ example: EXAMPLE_UPLOAD_ID }) });

const UPLOAD_INPUT = {
  filename: 'Olena Kovalenko CV.pdf',
  mime: 'application/pdf',
  sizeBytes: 184_320,
} satisfies ResumeUploadInput;

const SIGNED_QUERY = [
  'X-Amz-Algorithm=AWS4-HMAC-SHA256',
  'X-Amz-Date=20261107T100000Z',
  `X-Amz-Expires=${String(RESUME_UPLOAD_LIMITS.uploadUrlTtlSeconds)}`,
  'X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost',
  'X-Amz-Signature=5d41402abc4b2a76b9719d911017c592',
].join('&');

const TICKET = {
  uploadId: EXAMPLE_UPLOAD_ID,
  url: `http://localhost:9000/resumes/users/0199f0a0-0000-7000-8000-000000000001/resumes/${EXAMPLE_UPLOAD_ID}.pdf?${SIGNED_QUERY}`,
  method: 'PUT',
  headers: { 'Content-Type': 'application/pdf' },
  expiresAt: '2026-11-07T10:10:00.000Z',
} satisfies ResumeUploadTicket;

const CONFIRM_INPUT = { mime: 'application/pdf' } satisfies ConfirmResumeUploadInput;

const CONFIRMED = {
  uploadId: EXAMPLE_UPLOAD_ID,
  mime: 'application/pdf',
  sizeBytes: 184_320,
} satisfies ConfirmedResumeUpload;

const MAX_BYTES = String(RESUME_UPLOAD_LIMITS.maxBytes);

const UPLOAD_TTL_MINUTES = String(RESUME_UPLOAD_LIMITS.uploadUrlTtlSeconds / 60);

export const RESUMES_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'post',
    path: UPLOADS_PATH,
    tags: TAGS,
    summary: 'A presigned URL to upload one resume file straight to storage',
    description: `Takes a PDF or DOCX of at most ${MAX_BYTES} bytes; a larger sizeBytes answers 422 and signs nothing. The URL is valid ${UPLOAD_TTL_MINUTES} minutes and only for a PUT with the returned Content-Type and a body of exactly sizeBytes. Nothing is kept until the upload is confirmed.`,
    request: {
      body: {
        required: true,
        description: `filename 1 to ${String(RESUME_UPLOAD_LIMITS.filenameMaxLength)} characters, mime application/pdf or the DOCX type, sizeBytes 1 to ${MAX_BYTES}.`,
        content: jsonContent(resumeUploadInputSchema, UPLOAD_INPUT),
      },
    },
    responses: {
      201: {
        description: 'The upload ticket',
        content: jsonContent(resumeUploadTicketSchema, TICKET),
      },
      ...errorResponses([400, 401, 403, 422]),
    },
  },
  {
    method: 'post',
    path: `${UPLOADS_PATH}/{uploadId}/confirm`,
    tags: TAGS,
    summary: 'Check an uploaded resume file',
    description: `Looks for the file under the signed-in user's key, so another user's uploadId answers 404. The file must be at most ${MAX_BYTES} bytes, stored with the declared type and start with the PDF (%PDF-) or DOCX (PK) signature of that type; otherwise it is deleted and the answer is 422 at file. A repeat confirm of a good file answers the same.`,
    request: {
      params: uploadIdParams,
      body: {
        required: true,
        description: 'The type the ticket was asked for.',
        content: jsonContent(confirmResumeUploadInputSchema, CONFIRM_INPUT),
      },
    },
    responses: {
      200: {
        description: 'The file is a resume of the declared type',
        content: jsonContent(confirmedResumeUploadSchema, CONFIRMED),
      },
      ...errorResponses([400, 401, 403, 404, 422, 503]),
    },
  },
];
