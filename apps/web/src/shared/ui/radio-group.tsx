'use client';

import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';

import { CHOICE_ROW } from './field-surface';

export type ChoiceOption<Value extends string = string> = { value: Value; label: string };

export type RadioGroupProps = Readonly<{
  'aria-label': string;
  options: readonly ChoiceOption[];
  value: string;
  onValueChange: (value: string) => void;
}>;

export function RadioGroup({ options, ...props }: RadioGroupProps) {
  return (
    <RadioGroupPrimitive.Root {...props} className="flex flex-col">
      {options.map((option) => (
        <label key={option.value} className={CHOICE_ROW}>
          <RadioGroupPrimitive.Item
            value={option.value}
            className="flex size-4.5 flex-none items-center justify-center rounded-pill bg-surface inset-ring-[1.5px] inset-ring-ink-3/30 transition-shadow duration-(--duration-instant) ease-standard data-[state=checked]:inset-ring-accent"
          >
            <RadioGroupPrimitive.Indicator className="size-2 rounded-pill bg-accent" />
          </RadioGroupPrimitive.Item>
          {option.label}
        </label>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
