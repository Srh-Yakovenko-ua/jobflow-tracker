'use client';

import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';

import type { ChoiceOption } from './radio-group';

export type SegmentedControlProps<Value extends string> = Readonly<{
  'aria-label': string;
  options: readonly ChoiceOption<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
}>;

export function SegmentedControl<Value extends string>({
  options,
  onValueChange,
  ...props
}: SegmentedControlProps<Value>) {
  return (
    <RadioGroupPrimitive.Root
      {...props}
      orientation="horizontal"
      onValueChange={(next) => {
        const picked = options.find((option) => option.value === next);
        if (picked) onValueChange(picked.value);
      }}
      className="inline-flex w-fit gap-0.5 rounded-md bg-surface-3 p-0.75 inset-ring inset-ring-line-soft"
    >
      {options.map((option) => (
        <RadioGroupPrimitive.Item
          key={option.value}
          value={option.value}
          className="touch-target h-7.5 rounded-[7px] px-3.25 font-ui text-[12.5px] font-semibold whitespace-nowrap text-ink-2 transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-standard hover:text-ink data-[state=checked]:bg-surface data-[state=checked]:text-ink data-[state=checked]:shadow-e1"
        >
          {option.label}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
