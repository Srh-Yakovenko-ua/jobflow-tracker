import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';

import { Combobox } from './combobox';
import { ComboboxMenu } from './combobox-menu';
import { DateField } from './date-field';
import { Input } from './input';
import { NumberInput } from './number-input';
import { PasswordInput } from './password-input';
import { Select } from './select';
import { SOURCE_OPTIONS } from './specimen-options';
import { TagInput } from './tag-input';

const SOURCE = uk.devUi.selects.source;

const GROUPS = [{ options: SOURCE_OPTIONS }];

const VIEW = { label: SOURCE.label, search: SOURCE.search };

type FieldCase = Readonly<{
  name: string;
  field: ReactElement;
  desktop: string;
  box: 'control' | 'shell';
}>;

const FIELDS: readonly FieldCase[] = [
  { name: 'input', field: <Input />, desktop: 'h-control-md', box: 'shell' },
  { name: 'password input', field: <PasswordInput />, desktop: 'h-control-md', box: 'shell' },
  {
    name: 'number input',
    field: <NumberInput value={3} onValueChange={vi.fn()} range={{ min: 0, max: 9 }} />,
    desktop: 'h-control-md',
    box: 'shell',
  },
  {
    name: 'tag input',
    field: <TagInput value={[]} onValueChange={vi.fn()} />,
    desktop: 'min-h-control-md',
    box: 'shell',
  },
  {
    name: 'date field',
    field: (
      <DateField selection={{ value: null, onSelect: vi.fn() }} days={{ today: '2026-09-07' }} />
    ),
    desktop: 'h-control-md',
    box: 'control',
  },
  {
    name: 'select',
    field: <Select groups={GROUPS} value="" onValueChange={vi.fn()} />,
    desktop: 'h-9.5',
    box: 'control',
  },
  {
    name: 'combobox',
    field: (
      <Combobox
        groups={GROUPS}
        selection={{ mode: 'single', value: '', onValueChange: vi.fn() }}
        view={VIEW}
      />
    ),
    desktop: 'min-h-9.5',
    box: 'shell',
  },
  {
    name: 'combobox menu search',
    field: (
      <ComboboxMenu
        groups={GROUPS}
        selection={{ mode: 'single', picked: [] }}
        actions={{ onPick: vi.fn() }}
        view={VIEW}
      />
    ),
    desktop: 'h-8.5',
    box: 'shell',
  },
];

describe('field surface', () => {
  it.each(FIELDS)(
    'the $name keeps its $desktop box above md and grows to a 44 px box below it',
    ({ field, desktop, box }) => {
      const { container } = render(field);

      const control = container.querySelector('[data-focus="halo"]');
      const classes = (box === 'control' ? control : control?.parentElement)?.className.split(' ');

      expect(classes).toContain('max-md:min-h-11');
      expect(classes).toContain(desktop);
    },
  );
});
