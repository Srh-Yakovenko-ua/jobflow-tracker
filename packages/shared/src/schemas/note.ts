import { z } from 'zod';

import { rawTextSchema } from './text.js';

export const NOTE_LIMITS = { bodyMaxLength: 20_000 } as const;

export const noteSchema = z.object({
  id: z.uuid(),
  applicationId: z.uuid(),
  body: z.string().min(1).max(NOTE_LIMITS.bodyMaxLength),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const noteInputSchema = z.object({ body: rawTextSchema(NOTE_LIMITS.bodyMaxLength) });

export const noteIdSchema = z.uuid();

export const noteListResponseSchema = z.object({ items: z.array(noteSchema) });

export type Note = z.infer<typeof noteSchema>;
export type NoteInput = z.infer<typeof noteInputSchema>;
export type NoteListResponse = z.infer<typeof noteListResponseSchema>;
