'use client';

import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

import { useField } from './field';
import { FIELD_SURFACE } from './field-surface';

export type TextareaProps = ComponentProps<'textarea'>;

export function Textarea({ className, disabled, ...props }: TextareaProps) {
  const field = useField();
  return (
    <textarea
      data-focus="halo"
      data-invalid={field['aria-invalid']}
      data-disabled={disabled || undefined}
      {...field}
      {...props}
      disabled={disabled}
      className={cn(
        FIELD_SURFACE.self,
        'field-sizing-content min-h-24 resize-y px-3 py-2.5 leading-[1.55] outline-hidden placeholder:text-ink-3',
        className,
      )}
    />
  );
}
