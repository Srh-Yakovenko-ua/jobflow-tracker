'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { ApplicationResponse, Contact, CreateContactInput } from '@jobflow/shared';
import { UserPlus } from 'lucide-react';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import type { GuardedSave } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { FormServerError } from '@/shared/ui/form-server-error';

import { EMPTY_CONTACT, newContactSchema, suggestionInputOf } from '../model/contact-form';
import { useCreateContactMutation } from '../model/use-create-contact-mutation';
import { ContactTextField } from './contact-fields';

export type AddContactFormProps = Readonly<{
  application: ApplicationResponse;
  suggestions: readonly Contact[];
  actions: { onDone: () => void };
}>;

type SuggestionListProps = Readonly<{
  suggestions: readonly Contact[];
  creation: GuardedSave<CreateContactInput>;
}>;

const COPY = uk.contact;

function suggestionLabelOf({ name, role }: Contact): string {
  return COPY.summary(role === null ? [name] : [name, role]);
}

function SuggestionList({ suggestions, creation }: SuggestionListProps) {
  const headingId = useId();
  if (suggestions.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p id={headingId} className="caption text-ink-3">
        {COPY.suggestions}
      </p>
      <ul aria-labelledby={headingId} className="flex flex-col gap-1">
        {suggestions.map((suggestion) => (
          <li key={suggestion.id} className="flex">
            <Button
              variant="ghost"
              size="sm"
              icon={<UserPlus aria-hidden size={16} strokeWidth={1.9} />}
              disabled={creation.isPending}
              onClick={() => {
                creation.save(suggestionInputOf(suggestion));
              }}
              className="-mx-3.25 max-w-full"
            >
              <span className="truncate">{suggestionLabelOf(suggestion)}</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AddContactForm({ application, suggestions, actions }: AddContactFormProps) {
  const methods = useForm({
    mode: 'onTouched',
    defaultValues: EMPTY_CONTACT,
    resolver: zodResolver(newContactSchema),
  });
  const creation = useCreateContactMutation({
    applicationId: application.id,
    setError: methods.setError,
    onDone: actions.onDone,
  });
  const submit = methods.handleSubmit(creation.save);
  return (
    <div className="flex flex-col gap-4">
      <form
        noValidate
        onSubmit={(event) => {
          void submit(event);
        }}
        className="flex flex-col gap-3"
      >
        <FormServerError control={methods.control} />
        <ContactTextField methods={methods} name="name" />
        <Button type="submit" variant="outline" loading={creation.isPending} className="self-start">
          {COPY.add}
        </Button>
      </form>
      <SuggestionList suggestions={suggestions} creation={creation} />
    </div>
  );
}
