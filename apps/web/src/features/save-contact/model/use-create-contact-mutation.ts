import type { Application, CreateContactInput } from '@jobflow/shared';

import { createContact } from '@/entities/contact';

import { NEW_CONTACT_FIELDS } from './contact-form';
import { type ContactFormWiring, useContactMutation } from './contact-mutation';

export type UseCreateContactMutationOptions = ContactFormWiring &
  Readonly<{ applicationId: Application['id'] }>;

export function useCreateContactMutation({
  applicationId,
  ...wiring
}: UseCreateContactMutationOptions) {
  return useContactMutation({
    request: (body: CreateContactInput) => createContact({ applicationId, body }),
    fields: NEW_CONTACT_FIELDS,
    ...wiring,
  });
}
