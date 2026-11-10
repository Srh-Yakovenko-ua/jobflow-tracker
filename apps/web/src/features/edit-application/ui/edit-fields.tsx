'use client';

import { STACK_MAX_ITEMS, type UpdateApplicationInput } from '@jobflow/shared';
import type { ComponentProps, ReactNode } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';

import { uk } from '@/shared/i18n';
import { useFieldError } from '@/shared/lib/use-field-error';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { TagInput } from '@/shared/ui/tag-input';

import type { EditField, EditFormValues } from '../model/edit-form';

export type EditorForm = Readonly<{
  methods: UseFormReturn<EditFormValues, unknown, UpdateApplicationInput | null>;
  focusField?: EditField;
}>;

export type EditFieldView = Readonly<{ label?: string; aside?: ReactNode; placeholder?: string }>;

export type TextFieldName = Exclude<EditField, 'workMode' | 'stack'>;

export type TextFieldProps = Readonly<{
  form: EditorForm;
  name: TextFieldName;
  input?: Pick<ComponentProps<'input'>, 'inputMode' | 'maxLength' | 'type'>;
  view?: EditFieldView;
}>;

export type StackFieldProps = Readonly<{ form: EditorForm; view?: EditFieldView }>;

const COPY = uk.applicationPage.editor;

export const EDIT_LABELS: Readonly<Record<EditField, string>> = COPY.fields;

export const EDIT_ERRORS: Readonly<Record<EditField, string>> = {
  ...COPY.errors,
  stack: COPY.stackLimit(STACK_MAX_ITEMS),
};

export const AMOUNT_INPUT = { inputMode: 'numeric' } as const;

export function TextField({ form, name, input, view = {} }: TextFieldProps) {
  const error = useFieldError({ control: form.methods.control, name, messages: EDIT_ERRORS });
  return (
    <Field label={view.label ?? EDIT_LABELS[name]} aside={view.aside} footer={{ error }}>
      <Input {...input} autoFocus={form.focusField === name} {...form.methods.register(name)} />
    </Field>
  );
}

export function StackField({ form, view = {} }: StackFieldProps) {
  const error = useFieldError({
    control: form.methods.control,
    name: 'stack',
    messages: EDIT_ERRORS,
  });
  return (
    <Field label={view.label ?? EDIT_LABELS.stack} aside={view.aside} footer={{ error }}>
      <Controller
        control={form.methods.control}
        name="stack"
        render={({ field }) => (
          <TagInput
            value={field.value}
            onValueChange={field.onChange}
            placeholder={view.placeholder ?? COPY.stackPlaceholder}
            autoFocus={form.focusField === 'stack'}
          />
        )}
      />
    </Field>
  );
}
