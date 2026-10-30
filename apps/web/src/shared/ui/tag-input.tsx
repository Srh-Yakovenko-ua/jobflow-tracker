'use client';

import type { KeyboardEvent } from 'react';
import { useRef, useState } from 'react';

import { cn } from '@/shared/lib/cn';

import { Chip } from './chip';
import { useField } from './field';
import { FIELD_SURFACE } from './field-surface';

export type TagInputProps = Readonly<{
  value: readonly string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  autoFocus?: boolean;
}>;

export function TagInput({ value, onValueChange, placeholder, autoFocus }: TagInputProps) {
  const field = useField();
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const remove = (tag: string) => {
    onValueChange(value.filter((item) => item !== tag));
    inputRef.current?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const tag = draft.trim();
    if (event.key === 'Enter' && tag !== '') {
      event.preventDefault();
      if (!value.includes(tag)) onValueChange([...value, tag]);
      setDraft('');
      return;
    }
    if (event.key === 'Backspace' && draft === '') onValueChange(value.slice(0, -1));
  };
  return (
    <div
      data-invalid={field['aria-invalid']}
      className={cn(FIELD_SURFACE.shell, 'min-h-control-md flex-wrap gap-1.5 px-2 py-1.5')}
    >
      {value.map((tag) => (
        <Chip
          key={tag}
          label={tag}
          tone="neutral"
          onRemove={() => {
            remove(tag);
          }}
        />
      ))}
      <input
        ref={inputRef}
        data-focus="halo"
        {...field}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(FIELD_SURFACE.control, 'min-w-22.5 text-[13px]')}
      />
    </div>
  );
}
