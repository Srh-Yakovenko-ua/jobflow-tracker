'use client';

import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import { useField } from './field';
import { FIELD_SURFACE } from './field-surface';

export type InputAdornments = { start?: ReactNode; end?: ReactNode };

export type InputProps = ComponentProps<'input'> & { adornments?: InputAdornments };

export function Input({ adornments, className, disabled, ...props }: InputProps) {
  const field = useField();
  return (
    <div
      data-invalid={field['aria-invalid']}
      data-disabled={disabled || undefined}
      className={cn(FIELD_SURFACE.shell, FIELD_SURFACE.height.field, 'gap-2 px-3', className)}
    >
      {adornments?.start}
      <input
        data-focus="halo"
        {...field}
        {...props}
        disabled={disabled}
        className={FIELD_SURFACE.control}
      />
      {adornments?.end}
    </div>
  );
}
