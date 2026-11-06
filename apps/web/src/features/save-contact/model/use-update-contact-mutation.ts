import type { Contact, UpdateContactInput } from '@jobflow/shared';

import { updateContact } from '@/entities/contact';

import { CONTACT_FIELDS } from './contact-form';
import { type ContactFormWiring, useContactMutation } from './contact-mutation';

export type UseUpdateContactMutationOptions = ContactFormWiring & Readonly<{ contact: Contact }>;

export function useUpdateContactMutation({ contact, ...wiring }: UseUpdateContactMutationOptions) {
  return useContactMutation({
    request: (body: UpdateContactInput) =>
      updateContact({ applicationId: contact.applicationId, contactId: contact.id, body }),
    fields: CONTACT_FIELDS,
    ...wiring,
  });
}
