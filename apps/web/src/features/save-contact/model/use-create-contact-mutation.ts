import type { Application, CreateContactInput } from '@jobflow/shared';

import { createContact } from '@/entities/contact';
import { useSubmitKey } from '@/shared/api';

import { NEW_CONTACT_FIELDS } from './contact-form';
import { type ContactFormWiring, useContactMutation } from './contact-mutation';

export type UseCreateContactMutationOptions = ContactFormWiring &
  Readonly<{ applicationId: Application['id'] }>;

export function useCreateContactMutation({
  applicationId,
  ...wiring
}: UseCreateContactMutationOptions) {
  const submitKey = useSubmitKey();
  return useContactMutation({
    request: async (body: CreateContactInput) => {
      const contact = await createContact({
        applicationId,
        body,
        idempotencyKey: submitKey.keyFor(body),
      });
      submitKey.reset();
      return contact;
    },
    fields: NEW_CONTACT_FIELDS,
    ...wiring,
  });
}
