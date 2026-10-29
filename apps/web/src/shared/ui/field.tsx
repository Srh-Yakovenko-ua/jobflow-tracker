'use client';

import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { createContext, use, useId } from 'react';

import { cn } from '@/shared/lib/cn';

const COUNTER_WARNING_SHARE = 0.95;

export type FieldCounter = { value: number; max: number };

export type FieldProps = Readonly<{
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  counter?: FieldCounter;
}>;

export type FieldControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
};

const FieldContext = createContext<FieldControlProps>({});

export function useField(): FieldControlProps {
  return use(FieldContext);
}

function FieldMessage({ hint, error }: Pick<FieldProps, 'hint' | 'error'>) {
  return (
    <span aria-live="polite" className="flex min-w-0 items-start gap-1.5">
      {error ? (
        <>
          <CircleAlert aria-hidden size={14} className="mt-px flex-none text-danger" />
          <span className="text-danger">{error}</span>
        </>
      ) : (
        <span className="text-ink-3">{hint}</span>
      )}
    </span>
  );
}

function CounterText({ counter }: Readonly<{ counter: FieldCounter }>) {
  const nearLimit = counter.value > counter.max * COUNTER_WARNING_SHARE;
  return (
    <span className={cn('flex-none tabular-nums', nearLimit ? 'text-danger' : 'text-ink-3')}>
      {`${String(counter.value)}/${String(counter.max)}`}
    </span>
  );
}

export function Field({ label, children, hint, error, counter }: FieldProps) {
  const id = useId();
  const footerId = `${id}-footer`;
  const hasFooter = Boolean(hint ?? error) || counter !== undefined;
  const control: FieldControlProps = {
    id,
    ...(hasFooter && { 'aria-describedby': footerId }),
    ...(Boolean(error) && { 'aria-invalid': true }),
  };
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="label w-fit text-ink">
        {label}
      </label>
      <FieldContext value={control}>{children}</FieldContext>
      {hasFooter && (
        <div id={footerId} className="caption flex items-start justify-between gap-3">
          <FieldMessage hint={hint} error={error} />
          {counter && <CounterText counter={counter} />}
        </div>
      )}
    </div>
  );
}
