import { z } from 'zod';

import { AI_JOB_FAILURES, AI_JOB_STATUSES } from '../ai-statuses.js';
import { isNonEmptyPatch, NON_EMPTY_PATCH_ISSUE } from './patch.js';
import {
  resumeUploadInputSchema,
  resumeUploadTicketSchema,
  uploadIdSchema,
} from './resume-upload.js';
import { plainTextSchema, rawTextSchema } from './text.js';

export const RESUME_VERSION_LIMITS = {
  titleMaxLength: 120,
  noteMaxLength: 2000,
} as const;

export const RESUME_PROFILE_STATUSES = [...AI_JOB_STATUSES, AI_JOB_FAILURES.needsText] as const;

export const resumeProfileStatusSchema = z.enum(RESUME_PROFILE_STATUSES);

export const resumeVersionIdSchema = z.uuid();

export const resumeVersionSchema = z.object({
  id: resumeVersionIdSchema,
  number: z.int().positive(),
  title: z.string().min(1),
  note: z.string().nullable(),
  filename: z.string().min(1),
  mime: z.string().min(1),
  sizeBytes: z.int().nonnegative(),
  isArchived: z.boolean(),
  uploadedAt: z.iso.datetime(),
  aiProfileStatus: resumeProfileStatusSchema,
  applicationsCount: z.int().nonnegative(),
});

export const resumeVersionListResponseSchema = z.object({ items: z.array(resumeVersionSchema) });

export const resumeVersionLabelSchema = resumeVersionSchema.pick({ number: true, title: true });

const resumeVersionFieldsSchema = z.object({
  title: plainTextSchema(RESUME_VERSION_LIMITS.titleMaxLength),
  note: rawTextSchema(RESUME_VERSION_LIMITS.noteMaxLength).nullable(),
});

export const createResumeVersionInputSchema = resumeUploadInputSchema
  .pick({ filename: true, mime: true })
  .extend({
    uploadId: uploadIdSchema,
    title: resumeVersionFieldsSchema.shape.title,
    note: resumeVersionFieldsSchema.shape.note.optional(),
  });

export const updateResumeVersionInputSchema = resumeVersionFieldsSchema
  .extend({ isArchived: z.boolean() })
  .partial()
  .refine(isNonEmptyPatch, NON_EMPTY_PATCH_ISSUE);

export const relinkResumeVersionInputSchema = z.object({ resumeVersionId: resumeVersionIdSchema });

export const resumeDownloadSchema = resumeUploadTicketSchema.pick({ url: true, expiresAt: true });

export type ResumeProfileStatus = z.infer<typeof resumeProfileStatusSchema>;
export type ResumeVersion = z.infer<typeof resumeVersionSchema>;
export type ResumeVersionListResponse = z.infer<typeof resumeVersionListResponseSchema>;
export type ResumeVersionLabelParts = z.infer<typeof resumeVersionLabelSchema>;
export type CreateResumeVersionInput = z.infer<typeof createResumeVersionInputSchema>;
export type UpdateResumeVersionInput = z.infer<typeof updateResumeVersionInputSchema>;
export type RelinkResumeVersionInput = z.infer<typeof relinkResumeVersionInputSchema>;
export type ResumeDownload = z.infer<typeof resumeDownloadSchema>;

export const resumeVersionLabel = ({ number, title }: ResumeVersionLabelParts) =>
  `CV v${String(number)} · ${title}`;
