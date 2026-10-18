import { z } from 'zod';

export const resumeVersionSchema = z.object({
  id: z.uuid(),
  resumeId: z.uuid(),
  filename: z.string().min(1),
  mime: z.string().min(1),
  sizeBytes: z.int().nonnegative(),
  title: z.string().min(1),
  note: z.string().nullable(),
  aiProfile: z.record(z.string(), z.unknown()).nullable(),
  isArchived: z.boolean(),
  uploadedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type ResumeVersion = z.infer<typeof resumeVersionSchema>;
