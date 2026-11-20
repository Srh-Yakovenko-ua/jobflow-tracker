import { REJECTION_SIDES } from '@jobflow/shared';
import { useState } from 'react';

import { devUk } from '@/shared/i18n/dev-uk';
import type { ComboboxProps } from '@/shared/ui/combobox';
import type { SelectOption } from '@/shared/ui/field-surface';
import type { ChoiceOption } from '@/shared/ui/radio-group';

const STACK_OPTIONS: readonly SelectOption[] = [
  { value: 'react', label: 'React', meta: '18' },
  { value: 'typescript', label: 'TypeScript', meta: '21' },
  { value: 'node', label: 'Node.js', meta: '12' },
  { value: 'graphql', label: 'GraphQL', meta: '5' },
  { value: 'aws', label: 'AWS', meta: '9' },
  { value: 'kafka', label: 'Kafka', meta: '3' },
];

export const SIDE_OPTIONS: readonly ChoiceOption[] = REJECTION_SIDES.flatMap((side) =>
  side === 'system' ? [] : [{ value: side, label: devUk.devUi.choice.radios[side] }],
);

export type StackSpecimen = Pick<ComboboxProps, 'groups' | 'selection' | 'onCreate'>;

export function useStackSpecimen(initial: readonly string[]): StackSpecimen {
  const [options, setOptions] = useState<readonly SelectOption[]>(STACK_OPTIONS);
  const [value, setValue] = useState<string[]>([...initial]);
  return {
    groups: [{ label: devUk.devUi.selects.stack.group(options.length), options }],
    selection: { mode: 'multi', value, onValueChange: setValue },
    onCreate: (query) => {
      setOptions([...options, { value: query, label: query }]);
      setValue([...value, query]);
    },
  };
}
