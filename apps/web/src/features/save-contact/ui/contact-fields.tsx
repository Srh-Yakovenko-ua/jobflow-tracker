'use client';

import type { ComponentProps } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { uk } from '@/shared/i18n';
import { useFieldError } from '@/shared/lib/use-field-error';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';

import type { ContactField, ContactFormValues } from '../model/contact-form';

export type ContactFormMethods<Output> = UseFormReturn<ContactFormValues, unknown, Output>;

type ContactTextFieldProps<Output> = Readonly<{
  methods: ContactFormMethods<Output>;
  name: ContactField;
  autoFocus?: boolean;
}>;

type InputLook = Pick<ComponentProps<'input'>, 'type' | 'inputMode' | 'spellCheck'>;

const COPY = uk.contact;

const INPUTS: Readonly<Partial<Record<ContactField, InputLook>>> = {
  email: { type: 'email', inputMode: 'email', spellCheck: false },
  telegram: { spellCheck: false },
};

export function ContactTextField<Output>({
  methods,
  name,
  autoFocus = false,
}: ContactTextFieldProps<Output>) {
  const error = useFieldError({ control: methods.control, name, messages: COPY.errors });
  return (
    <Field label={COPY.fields[name]} footer={{ error }}>
      <Input
        autoComplete="off"
        autoFocus={autoFocus}
        {...INPUTS[name]}
        {...methods.register(name)}
      />
    </Field>
  );
}
