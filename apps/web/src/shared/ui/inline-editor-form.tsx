'use client';

import type { KeyboardEvent, ReactNode, SubmitEvent } from 'react';
import type { Control, FieldValues } from 'react-hook-form';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { Button } from './button';
import { FormServerError } from './form-server-error';
import { OWNS_ESCAPE } from './sheet';

export type InlineEditorFormProps<Values extends FieldValues, Output> = Readonly<{
  form: Readonly<{
    control: Control<Values, unknown, Output>;
    onSubmit: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
    pending: boolean;
  }>;
  actions: Readonly<{ onCancel: () => void }>;
  children: ReactNode;
  className?: string;
}>;

const COPY = uk.ui.editor;

export function InlineEditorForm<Values extends FieldValues, Output>({
  form,
  actions,
  children,
  className,
}: InlineEditorFormProps<Values, Output>) {
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    actions.onCancel();
  };
  return (
    <form
      {...OWNS_ESCAPE}
      noValidate
      onSubmit={(event) => {
        void form.onSubmit(event);
      }}
      onKeyDown={onKeyDown}
      className={cn('flex flex-col', className)}
    >
      <FormServerError control={form.control} />
      {children}
      <div className="flex flex-wrap gap-2.5">
        <Button type="submit" loading={form.pending}>
          {COPY.save}
        </Button>
        <Button variant="outline" onClick={actions.onCancel}>
          {COPY.cancel}
        </Button>
      </div>
    </form>
  );
}
