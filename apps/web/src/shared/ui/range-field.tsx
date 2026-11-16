'use client';

import { useId } from 'react';

export type RangeBounds = Readonly<{ min: number; max: number; step: number }>;

export type RangeValue = Readonly<{ current: number; shown: string; spoken: string }>;

export type RangeFieldProps = Readonly<{
  label: string;
  value: RangeValue;
  bounds: RangeBounds;
  onValueChange: (value: number) => void;
}>;

export function RangeField({ label, value, bounds, onValueChange }: RangeFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.75">
      <div className="flex justify-between gap-3 text-[12.5px] text-ink">
        <label htmlFor={id} className="min-w-0">
          {label}
        </label>
        <span aria-hidden className="shrink-0 font-semibold whitespace-nowrap tabular-nums">
          {value.shown}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={value.current}
        aria-valuetext={value.spoken}
        onChange={(event) => {
          onValueChange(event.currentTarget.valueAsNumber);
        }}
        className="-my-1.5 h-11 w-full cursor-pointer accent-accent"
      />
    </div>
  );
}
