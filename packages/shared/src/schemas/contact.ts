import { z } from 'zod';

export const contactSchema = z.object({
  id: z.uuid(),
  applicationId: z.uuid(),
  name: z.string().min(1),
  role: z.string().nullable(),
  email: z.email().nullable(),
  telegram: z.string().nullable(),
  phone: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Contact = z.infer<typeof contactSchema>;
