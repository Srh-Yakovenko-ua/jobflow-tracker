import { z } from 'zod';

import { isNonEmptyPatch, NON_EMPTY_PATCH_ISSUE } from './patch.js';
import { plainTextSchema } from './text.js';

export const CONTACT_LIMITS = {
  nameMaxLength: 200,
  roleMaxLength: 200,
  emailMaxLength: 254,
  noteMaxLength: 2000,
} as const;

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

const contactFieldsSchema = z.object({
  name: plainTextSchema(CONTACT_LIMITS.nameMaxLength),
  role: plainTextSchema(CONTACT_LIMITS.roleMaxLength).nullable(),
  email: z.email().max(CONTACT_LIMITS.emailMaxLength).nullable(),
  telegram: z
    .string()
    .regex(/^@?[A-Za-z0-9_]{5,32}$/)
    .nullable(),
  phone: z
    .string()
    .regex(/^\+?[0-9 ()-]{5,32}$/)
    .nullable(),
  note: plainTextSchema(CONTACT_LIMITS.noteMaxLength).nullable(),
});

export const createContactInputSchema = contactFieldsSchema
  .partial()
  .extend({ name: contactFieldsSchema.shape.name });

export const updateContactInputSchema = contactFieldsSchema
  .partial()
  .refine(isNonEmptyPatch, NON_EMPTY_PATCH_ISSUE);

export const contactIdSchema = z.uuid();

export const contactResponseSchema = contactSchema.extend({
  avgResponseHours: z.int().nonnegative().nullable(),
});

export const contactListResponseSchema = z.object({
  items: z.array(contactResponseSchema),
  suggestions: z.array(contactSchema),
});

export type Contact = z.infer<typeof contactSchema>;
export type CreateContactInput = z.infer<typeof createContactInputSchema>;
export type UpdateContactInput = z.infer<typeof updateContactInputSchema>;
export type ContactResponse = z.infer<typeof contactResponseSchema>;
export type ContactListResponse = z.infer<typeof contactListResponseSchema>;
