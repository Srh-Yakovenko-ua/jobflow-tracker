import type { Contact } from '@jobflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import type { UseFormSetError } from 'react-hook-form';

import { contactKeys } from '@/entities/contact';
import { type GuardedSave, useGuardedSave } from '@/shared/api';

import type { ContactField, ContactFormValues } from './contact-form';

export type ContactFormWiring = Readonly<{
  setError: UseFormSetError<ContactFormValues>;
  onDone: () => void;
}>;

type ContactMutationOptions<Body> = ContactFormWiring &
  Readonly<{
    request: (body: Body) => Promise<Contact>;
    fields: readonly ContactField[];
  }>;

const SAVE_KEY = [...contactKeys.all, 'save'] as const;

export function useContactMutation<Body>({
  request,
  fields,
  setError,
  onDone,
}: ContactMutationOptions<Body>): GuardedSave<Body> {
  const queryClient = useQueryClient();
  return useGuardedSave({
    mutationKey: SAVE_KEY,
    request,
    form: { fields, setError },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contactKeys.all });
      onDone();
    },
  });
}
