'use client';

import { type Control, type FieldValues, useFormState } from 'react-hook-form';

import { uk } from '@/shared/i18n';

import { Banner } from './banner';

export type FormServerErrorProps<Values extends FieldValues, Output> = Readonly<{
  control: Control<Values, unknown, Output>;
}>;

export function FormServerError<Values extends FieldValues, Output>({
  control,
}: FormServerErrorProps<Values, Output>) {
  const { errors } = useFormState({ control });
  if (errors.root?.server === undefined) return null;
  return <Banner tone="error" content={uk.ui.editor.invalid} />;
}
