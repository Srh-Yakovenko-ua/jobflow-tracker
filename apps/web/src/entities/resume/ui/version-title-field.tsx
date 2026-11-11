'use client';

import { RESUME_VERSION_LIMITS } from '@jobflow/shared';
import { type UseFormReturn, useWatch } from 'react-hook-form';

import { uk } from '@/shared/i18n';
import { useFieldError } from '@/shared/lib/use-field-error';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';

import type { VersionTitleForm } from '../model/version-title';

const COPY = uk.resumes.titleField;

const MESSAGES = { title: COPY.error };

export type VersionTitleFieldProps<Output> = Readonly<{
  methods: UseFormReturn<VersionTitleForm, unknown, Output>;
  autoFocus?: boolean;
}>;

export function VersionTitleField<Output>({
  methods,
  autoFocus = false,
}: VersionTitleFieldProps<Output>) {
  const { control, register } = methods;
  const error = useFieldError({ control, name: 'title', messages: MESSAGES });
  const title = useWatch({ control, name: 'title' });
  return (
    <Field
      label={COPY.label}
      footer={{
        error,
        counter: { value: title.length, max: RESUME_VERSION_LIMITS.titleMaxLength },
      }}
    >
      <Input autoComplete="off" autoFocus={autoFocus} {...register('title')} />
    </Field>
  );
}
