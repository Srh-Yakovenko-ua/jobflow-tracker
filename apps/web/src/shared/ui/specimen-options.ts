import { REJECTION_SIDES, SOURCE_LABELS, SOURCES } from '@jobflow/shared';
import { useState } from 'react';

import { uk } from '@/shared/i18n';

import type { ComboboxProps } from './combobox';
import type { SelectOption } from './field-surface';
import type { ChoiceOption } from './radio-group';

export const SOURCE_OPTIONS: readonly SelectOption[] = SOURCES.map((source) => ({
  value: source,
  label: SOURCE_LABELS[source].labelUk,
}));

const STACK_OPTIONS: readonly SelectOption[] = [
  { value: 'react', label: 'React', meta: '18' },
  { value: 'typescript', label: 'TypeScript', meta: '21' },
  { value: 'node', label: 'Node.js', meta: '12' },
  { value: 'graphql', label: 'GraphQL', meta: '5' },
  { value: 'aws', label: 'AWS', meta: '9' },
  { value: 'kafka', label: 'Kafka', meta: '3' },
];

export const SIDE_OPTIONS: readonly ChoiceOption[] = REJECTION_SIDES.flatMap((side) =>
  side === 'system' ? [] : [{ value: side, label: uk.devUi.choice.radios[side] }],
);

export type StackSpecimen = Pick<ComboboxProps, 'groups' | 'selection' | 'onCreate'>;

export function useStackSpecimen(initial: readonly string[]): StackSpecimen {
  const [options, setOptions] = useState<readonly SelectOption[]>(STACK_OPTIONS);
  const [value, setValue] = useState<string[]>([...initial]);
  return {
    groups: [{ label: uk.devUi.selects.stack.group(options.length), options }],
    selection: { mode: 'multi', value, onValueChange: setValue },
    onCreate: (query) => {
      setOptions([...options, { value: query, label: query }]);
      setValue([...value, query]);
    },
  };
}
