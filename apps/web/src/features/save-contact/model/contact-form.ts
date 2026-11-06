import {
  type Contact,
  type CreateContactInput,
  createContactInputSchema,
  updateContactInputSchema,
} from '@jobflow/shared';
import { z } from 'zod';

import { textOrNull } from '@/shared/lib/text-or-null';

export const CONTACT_FIELDS = ['name', 'role', 'email', 'telegram'] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];

export type ContactFormValues = Record<ContactField, string>;

export const EMPTY_CONTACT: ContactFormValues = { name: '', role: '', email: '', telegram: '' };

export const NEW_CONTACT_FIELDS = ['name'] as const satisfies readonly ContactField[];

export const newContactSchema = z
  .custom<ContactFormValues>()
  .transform(({ name }) => ({ name }))
  .pipe(createContactInputSchema);

const SUGGESTED_FIELDS = [
  'role',
  'email',
  'telegram',
  'phone',
  'note',
] as const satisfies readonly (keyof Contact)[];

export function formValuesOf(contact: Contact): ContactFormValues {
  return {
    name: contact.name,
    role: contact.role ?? '',
    email: contact.email ?? '',
    telegram: contact.telegram ?? '',
  };
}

export const contactPatchSchema = z
  .custom<ContactFormValues>()
  .transform((values): unknown => ({
    name: values.name,
    role: textOrNull(values.role),
    email: textOrNull(values.email),
    telegram: textOrNull(values.telegram),
  }))
  .pipe(updateContactInputSchema);

export function suggestionInputOf(suggestion: Contact): CreateContactInput {
  const known = SUGGESTED_FIELDS.flatMap((field) => {
    const value = suggestion[field];
    return value === null ? [] : [[field, value] as const];
  });
  return createContactInputSchema.parse({ name: suggestion.name, ...Object.fromEntries(known) });
}
