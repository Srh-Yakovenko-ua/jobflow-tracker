import { z } from 'zod';

import { plainTextSchema } from './text.js';

export const RESUME_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const resumeMimeSchema = z.enum(RESUME_MIMES);

export const RESUME_UPLOAD_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  uploadUrlTtlSeconds: 600,
  downloadUrlTtlSeconds: 300,
  filenameMaxLength: 255,
} as const;

export const uploadIdSchema = z.uuid();

const resumeSizeSchema = z.int().positive().max(RESUME_UPLOAD_LIMITS.maxBytes);

export const resumeUploadInputSchema = z.object({
  filename: plainTextSchema(RESUME_UPLOAD_LIMITS.filenameMaxLength),
  mime: resumeMimeSchema,
  sizeBytes: resumeSizeSchema,
});

export const resumeUploadTicketSchema = z.object({
  uploadId: uploadIdSchema,
  url: z.url(),
  method: z.literal('PUT'),
  headers: z.object({ 'Content-Type': resumeMimeSchema }),
  expiresAt: z.iso.datetime(),
});

export const confirmResumeUploadInputSchema = z.object({ mime: resumeMimeSchema });

export const confirmedResumeUploadSchema = z.object({
  uploadId: uploadIdSchema,
  mime: resumeMimeSchema,
  sizeBytes: resumeSizeSchema,
});

export type ResumeMime = z.infer<typeof resumeMimeSchema>;
export type ResumeUploadInput = z.infer<typeof resumeUploadInputSchema>;
export type ResumeUploadTicket = z.infer<typeof resumeUploadTicketSchema>;
export type ConfirmResumeUploadInput = z.infer<typeof confirmResumeUploadInputSchema>;
export type ConfirmedResumeUpload = z.infer<typeof confirmedResumeUploadSchema>;
