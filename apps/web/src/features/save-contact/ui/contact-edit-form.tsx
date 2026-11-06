'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Contact } from '@jobflow/shared';
import { useForm } from 'react-hook-form';

import { InlineEditorForm } from '@/shared/ui/inline-editor-form';

import { CONTACT_FIELDS, contactPatchSchema, formValuesOf } from '../model/contact-form';
import { useUpdateContactMutation } from '../model/use-update-contact-mutation';
import { ContactTextField } from './contact-fields';

export type ContactEditFormProps = Readonly<{
  contact: Contact;
  actions: { onDone: () => void; onCancel: () => void };
}>;

export function ContactEditForm({ contact, actions }: ContactEditFormProps) {
  const methods = useForm({
    mode: 'onBlur',
    defaultValues: formValuesOf(contact),
    resolver: zodResolver(contactPatchSchema),
  });
  const update = useUpdateContactMutation({
    contact,
    setError: methods.setError,
    onDone: actions.onDone,
  });
  return (
    <InlineEditorForm
      form={{
        control: methods.control,
        onSubmit: methods.handleSubmit(update.save),
        pending: update.isPending,
      }}
      actions={actions}
      className="gap-3.5"
    >
      {CONTACT_FIELDS.map((name) => (
        <ContactTextField key={name} methods={methods} name={name} autoFocus={name === 'name'} />
      ))}
    </InlineEditorForm>
  );
}
