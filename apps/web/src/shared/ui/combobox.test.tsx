import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';

import { Combobox, type ComboboxView } from './combobox';
import { Field } from './field';
import { SOURCE_OPTIONS, useStackSpecimen } from './specimen-options';

const SOURCE = uk.devUi.selects.source;
const STACK = uk.devUi.selects.stack;

const SOURCE_VIEW = { label: SOURCE.label, search: SOURCE.search, placeholder: SOURCE.placeholder };

const STACK_VIEW = { label: STACK.label, search: STACK.search, placeholder: STACK.placeholder };

type SourcePickerProps = Readonly<{
  value: string;
  onValueChange: (value: string) => void;
  view?: ComboboxView;
}>;

function SourcePicker({ view = SOURCE_VIEW, ...selection }: SourcePickerProps) {
  return (
    <Field label={SOURCE.label}>
      <Combobox
        groups={[{ options: SOURCE_OPTIONS }]}
        selection={{ mode: 'single', ...selection }}
        view={view}
      />
    </Field>
  );
}

type StackPickerProps = Readonly<{ initial: string[]; view?: ComboboxView }>;

function StackPicker({ initial, view = STACK_VIEW }: StackPickerProps) {
  const stack = useStackSpecimen(initial);
  return (
    <Field label={STACK.label}>
      <Combobox {...stack} view={view} />
    </Field>
  );
}

function triggerOf(label: string) {
  return screen.getByRole('combobox', { name: label });
}

async function openFromKeyboard(label: string) {
  const user = userEvent.setup();
  const trigger = triggerOf(label);
  await user.tab();
  await user.keyboard('{Enter}');
  await screen.findByRole('listbox', { name: label });
  return { user, trigger };
}

async function openSourcePicker(value = '') {
  const onValueChange = vi.fn();
  render(<SourcePicker value={value} onValueChange={onValueChange} />);
  return { onValueChange, ...(await openFromKeyboard(SOURCE.label)) };
}

describe('Combobox', () => {
  it('the single trigger is a combobox named by its label that reads the picked source as its value', () => {
    render(<SourcePicker value="djinni" onValueChange={vi.fn()} />);

    expect(triggerOf(SOURCE.label).textContent).toBe('Djinni');
  });

  it('a single pick that must keep a value offers no clear button, an optional one does', () => {
    const { rerender } = render(<SourcePicker value="djinni" onValueChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: uk.ui.clear })).toBeDefined();
    rerender(
      <SourcePicker
        value="djinni"
        onValueChange={vi.fn()}
        view={{ ...SOURCE_VIEW, clearable: false }}
      />,
    );
    expect(screen.queryByRole('button', { name: uk.ui.clear })).toBeNull();
  });

  it('the trigger hit area reaches 44 px over the 38 px control', () => {
    render(<SourcePicker value="" onValueChange={vi.fn()} />);

    expect(triggerOf(SOURCE.label).className).toContain('after:h-[max(100%,44px)]');
  });

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

  it('in single mode the check of the picked option sits after its label', async () => {
    await openSourcePicker('djinni');

    const picked = screen.getByRole('option', { name: 'Djinni' });
    expect(picked.lastElementChild?.querySelector('svg')).not.toBeNull();
  });

  it('the search clear button empties the query and gives focus back to the search', async () => {
    const { user } = await openSourcePicker();
    const search = screen.getByPlaceholderText(SOURCE.search);

    await user.keyboard('link');
    await user.click(screen.getByRole('button', { name: uk.ui.clear }));

    expect(search).toHaveProperty('value', '');
    expect(screen.getAllByRole('option')).toHaveLength(8);
    expect(document.activeElement).toBe(search);
  });

  it('Enter on the focused search clear button clears the query instead of picking an option', async () => {
    const { user, onValueChange } = await openSourcePicker();
    const search = screen.getByPlaceholderText(SOURCE.search);

    await user.keyboard('link');
    await user.tab();
    await user.keyboard('{Enter}');

    expect(search).toHaveProperty('value', '');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('ArrowDown moves the highlight off the first option before Enter picks', async () => {
    const { user, onValueChange } = await openSourcePicker();

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('dou');
  });

  it('Escape closes the menu without a change and gives focus back', async () => {
    const { user, onValueChange, trigger } = await openSourcePicker();

    await user.keyboard('{Escape}');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('the key hints show by default and a view with the footer off leaves them out', async () => {
    const { unmount } = render(<StackPicker initial={[]} />);
    await openFromKeyboard(STACK.label);
    expect(screen.getByText(uk.ui.navigate)).toBeDefined();
    unmount();

    render(<StackPicker initial={[]} view={{ ...STACK_VIEW, footer: false }} />);
    await openFromKeyboard(STACK.label);
    expect(screen.queryByText(uk.ui.navigate)).toBeNull();
  });

  it('in multi mode Enter adds the highlighted option as a chip, keeps the menu open and removes it again', async () => {
    render(<StackPicker initial={[]} />);
    const { user, trigger } = await openFromKeyboard(STACK.label);
    const nodeChip = { name: `${uk.ui.remove} Node.js` };

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(screen.getByRole('button', nodeChip)).toBeDefined();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await user.keyboard('{Enter}');
    expect(screen.queryByRole('button', nodeChip)).toBeNull();
  });

  it('a query with no match says so, and Enter on the add row adds it as a chip', async () => {
    const user = userEvent.setup();
    render(<StackPicker initial={['react']} />);

    await user.click(triggerOf(STACK.label));
    await user.keyboard('Rust');
    expect(screen.getByText(uk.ui.noMatches)).toBeDefined();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: `${uk.ui.remove} Rust` })).toBeDefined();
  });

  it('more than four chips fold into +N and a removed chip hands focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<StackPicker initial={['react', 'typescript', 'node', 'graphql', 'aws', 'kafka']} />);
    expect(screen.getByText('+2')).toBeDefined();

    await user.click(screen.getByRole('button', { name: `${uk.ui.remove} React` }));

    expect(screen.queryByRole('button', { name: `${uk.ui.remove} React` })).toBeNull();
    expect(screen.getByText('+1')).toBeDefined();
    expect(document.activeElement).toBe(triggerOf(STACK.label));
  });

  it('the last chip remove hit area ends halfway into the gap, so the trigger after it stays the trigger', () => {
    render(<StackPicker initial={['react']} />);

    const remove = screen.getByRole('button', { name: `${uk.ui.remove} React` }).className;
    expect(remove).toContain('after:left-auto');
    expect(remove).toContain('after:right-[-6.5px]');
  });

  it('the count on the highlighted row turns ink-2 in dark, where ink-3 on the tint falls under 4.5:1', async () => {
    render(<StackPicker initial={[]} />);
    await openFromKeyboard(STACK.label);

    expect(screen.getByText('18').className).toContain('dark:in-data-[selected=true]:text-ink-2');
  });

  it('clear all empties a multi selection back to the placeholder and focuses the trigger', async () => {
    const user = userEvent.setup();
    render(<StackPicker initial={['react', 'aws']} />);

    await user.click(screen.getByRole('button', { name: uk.ui.clearAll }));

    expect(screen.getByText(STACK.placeholder)).toBeDefined();
    expect(document.activeElement).toBe(triggerOf(STACK.label));
  });
});
