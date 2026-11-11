import { createResumeVersionInputSchema } from '@jobflow/shared';
import { z } from 'zod';

export const versionTitleFormSchema = z.object({
  title: createResumeVersionInputSchema.shape.title,
});

export type VersionTitleForm = z.input<typeof versionTitleFormSchema>;

export const VERSION_TITLE_FIELDS = ['title'] as const;
