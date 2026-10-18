import { z } from 'zod';

export const noteSchema = z.object({
  id: z.uuid(),
  applicationId: z.uuid(),
  body: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Note = z.infer<typeof noteSchema>;
