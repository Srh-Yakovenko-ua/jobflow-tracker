'use client';

import { Minus, Plus } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { useField } from './field';
import { FIELD_SURFACE } from './field-surface';

export type NumberRange = { min: number; max: number; step?: number };

export type NumberInputProps = Readonly<{
  value: number;
  onValueChange: (value: number) => void;
  range: NumberRange;
  unit?: string;
}>;

const STEP_BUTTON =
  'touch-target flex h-7 w-6.5 flex-none items-center justify-center rounded-xs bg-surface text-ink-2 shadow-e1 transition-colors duration-(--duration-instant) ease-standard enabled:hover:bg-accent-tint disabled:cursor-not-allowed disabled:text-ink-3/60 disabled:shadow-none';

const STEPS = [
  {
    direction: -1,
    label: uk.ui.decrease,
    Icon: Minus,
    hitArea: 'after:left-auto after:right-[-3px] after:[transform:translateY(-50%)]',
  },
  {
    direction: 1,
    label: uk.ui.increase,
    Icon: Plus,
    hitArea: 'after:left-[-3px] after:[transform:translateY(-50%)]',
  },
] as const;

const STEP_KEYS: Partial<Record<string, 1 | -1>> = { ArrowUp: 1, ArrowDown: -1 };

function clampTo(range: NumberRange, next: number): number {
  return Math.min(Math.max(next, range.min), range.max);
}

export function NumberInput({ value, onValueChange, range, unit }: NumberInputProps) {
  const field = useField();
  const [draft, setDraft] = useState<string | null>(null);
  const step = range.step ?? 1;
  const current = draft === null || draft === '' ? value : Number(draft);
  const commit = (next: number) => {
    setDraft(null);
    onValueChange(clampTo(range, next));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const direction = STEP_KEYS[event.key];
    if (event.key === 'Enter') commit(current);
    if (direction === undefined) return;
    event.preventDefault();
    commit(current + direction * step);
  };
  return (
    <div
      data-invalid={field['aria-invalid']}
      className={cn(FIELD_SURFACE.shell, FIELD_SURFACE.height.field, 'gap-1.5 pr-1 pl-3')}
    >
      <input
        data-focus="halo"
        {...field}
        type="text"
        role="spinbutton"
        inputMode="numeric"
        aria-valuenow={value}
        aria-valuemin={range.min}
        aria-valuemax={range.max}
        aria-valuetext={unit && `${String(value)} ${unit}`}
        size={Math.max(String(current).length, 1)}
        value={draft ?? String(value)}
        onChange={(event) => {
          setDraft(event.target.value.replace(/\D/g, ''));
        }}
        onBlur={() => {
          if (draft !== null) commit(current);
        }}
        onKeyDown={onKeyDown}
        className={cn(FIELD_SURFACE.control, 'field-sizing-content flex-none tabular-nums')}
      />
      <span className="flex-1 text-ink">{unit}</span>
      {STEPS.map(({ direction, label, Icon, hitArea }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          disabled={direction < 0 ? value <= range.min : value >= range.max}
          onClick={() => {
            commit(value + direction * step);
          }}
          className={cn(STEP_BUTTON, hitArea)}
        >
          <Icon aria-hidden size={13} />
        </button>
      ))}
    </div>
  );
}
