'use client';

import type { ReactNode } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

import type { GuardedSave } from '@/shared/api';
import { Button } from '@/shared/ui/button';
import { FormServerError } from '@/shared/ui/form-server-error';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

export type AddFormSubmit<Output> = Readonly<{
  label: string;
  variant: 'primary' | 'outline';
  mutation: GuardedSave<Output>;
  hint?: ReactNode;
}>;

export type AddFormProps<Values extends FieldValues, Output> = Readonly<{
  form: { label: string; methods: UseFormReturn<Values, unknown, Output> };
  submit: AddFormSubmit<Output>;
  children: ReactNode;
}>;

export function AddForm<Values extends FieldValues, Output>({
  form,
  submit,
  children,
}: AddFormProps<Values, Output>) {
  const send = form.methods.handleSubmit(submit.mutation.save);
  return (
    <form
      method="post"
      noValidate
      aria-label={form.label}
      onSubmit={(event) => {
        void send(event);
      }}
      className="flex flex-col gap-3.5"
    >
      {children}
      <FormServerError control={form.methods.control} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="lg"
          variant={submit.variant}
          loading={submit.mutation.isPending}
          className={TOUCH_HEIGHT}
        >
          {submit.label}
        </Button>
        {submit.hint}
      </div>
    </form>
  );
}
