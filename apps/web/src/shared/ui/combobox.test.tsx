import { SOURCE_LABELS } from '@jobflow/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';

import { Combobox } from './combobox';
import { Field } from './field';
import type { SelectOption } from './field-surface';

const SOURCE = uk.devUi.selects.source;
const STACK = uk.devUi.selects.stack;

const SOURCE_OPTIONS = (['djinni', 'dou', 'linkedin'] as const).map((source) => ({
  value: source,
  label: SOURCE_LABELS[source].labelUk,
}));

const STACK_OPTIONS = ['React', 'TypeScript', 'Node.js', 'GraphQL', 'AWS', 'Kafka'].map(
  (label) => ({ value: label.toLowerCase(), label }),
);

const SOURCE_VIEW = { label: SOURCE.label, search: SOURCE.search, placeholder: SOURCE.placeholder };

const STACK_VIEW = { label: STACK.label, search: STACK.search, placeholder: STACK.placeholder };

function SourcePicker({ onValueChange }: Readonly<{ onValueChange: (value: string) => void }>) {
  return (
    <Field label={SOURCE.label}>
      <Combobox
        groups={[{ options: SOURCE_OPTIONS }]}
        selection={{ mode: 'single', value: '', onValueChange }}
        view={SOURCE_VIEW}
      />
    </Field>
  );
}

function StackPicker({ initial }: Readonly<{ initial: string[] }>) {
  const [options, setOptions] = useState<SelectOption[]>(STACK_OPTIONS);
  const [value, setValue] = useState(initial);
  const onCreate = (query: string) => {
    setOptions([...options, { value: query, label: query }]);
    setValue([...value, query]);
  };
  return (
    <Field label={STACK.label}>
      <Combobox
        groups={[{ label: STACK.group, options }]}
        selection={{ mode: 'multi', value, onValueChange: setValue }}
        view={STACK_VIEW}
        onCreate={onCreate}
      />
    </Field>
  );
}

async function openSourcePicker() {
  const user = userEvent.setup();
  const onValueChange = vi.fn();
  render(<SourcePicker onValueChange={onValueChange} />);
  await user.tab();
  await user.keyboard('{Enter}');
  await screen.findByRole('listbox', { name: SOURCE.label });
  return { user, onValueChange, trigger: screen.getByRole('button', { name: SOURCE.label }) };
}

describe('Combobox', () => {
  it('typing filters, Enter picks the highlighted option and focus returns to the trigger', async () => {
    const { user, onValueChange, trigger } = await openSourcePicker();

    await user.keyboard('link');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['LinkedIn']);
    await user.keyboard('{Enter}');

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('linkedin');
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('Escape closes the menu without a change and gives focus back', async () => {
    const { user, onValueChange, trigger } = await openSourcePicker();

    await user.keyboard('{Escape}');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('a query with no match says so, and Enter on the add row adds it as a chip', async () => {
    const user = userEvent.setup();
    render(<StackPicker initial={['react']} />);

    await user.click(screen.getByRole('button', { name: STACK.label }));
    await user.keyboard('Rust');
    expect(screen.getByText(uk.ui.noMatches)).toBeDefined();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: `${uk.ui.remove} Rust` })).toBeDefined();
  });

  it('more than four chips fold into +N and a chip leaves by its remove button', async () => {
    const user = userEvent.setup();
    render(<StackPicker initial={['react', 'typescript', 'node.js', 'graphql', 'aws', 'kafka']} />);
    expect(screen.getByText('+2')).toBeDefined();

    await user.click(screen.getByRole('button', { name: `${uk.ui.remove} React` }));

    expect(screen.queryByRole('button', { name: `${uk.ui.remove} React` })).toBeNull();
    expect(screen.getByText('+1')).toBeDefined();
  });

  it('clear all empties a multi selection back to the placeholder', async () => {
    const user = userEvent.setup();
    render(<StackPicker initial={['react', 'aws']} />);

    await user.click(screen.getByRole('button', { name: uk.ui.clearAll }));

    expect(screen.getByText(STACK.placeholder)).toBeDefined();
  });
});
