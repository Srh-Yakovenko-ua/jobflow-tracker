'use client';

import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';

import { CHOICE_ROW } from './field-surface';

export type ChoiceOption<Value extends string = string> = { value: Value; label: string };

export type RadioGroupProps<Value extends string> = Readonly<{
  'aria-label': string;
  options: readonly ChoiceOption<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
}>;

type ChoiceChange<Value extends string> = Pick<RadioGroupProps<Value>, 'options' | 'onValueChange'>;

export function choiceChangeOf<Value extends string>({
  options,
  onValueChange,
}: ChoiceChange<Value>): (next: string) => void {
  return (next) => {
    const picked = options.find((option) => option.value === next);
    if (picked) onValueChange(picked.value);
  };
}

export function RadioGroup<Value extends string>({
  options,
  onValueChange,
  ...props
}: RadioGroupProps<Value>) {
  return (
    <RadioGroupPrimitive.Root
      {...props}
      onValueChange={choiceChangeOf({ options, onValueChange })}
      className="flex flex-col"
    >
      {options.map((option) => (
        <label key={option.value} className={CHOICE_ROW}>
          <RadioGroupPrimitive.Item
            value={option.value}
            className="touch-target flex size-4.5 flex-none items-center justify-center rounded-pill bg-surface inset-ring-[1.5px] inset-ring-ink-3/30 transition-shadow duration-(--duration-instant) ease-standard data-[state=checked]:inset-ring-accent"
          >
            <RadioGroupPrimitive.Indicator className="size-2 animate-check-in rounded-pill bg-accent data-[state=unchecked]:animate-check-out" />
          </RadioGroupPrimitive.Item>
          {option.label}
        </label>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
