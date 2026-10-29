import { SOURCE_LABELS } from '@jobflow/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';

import { Field } from './field';
import { Select, type SelectProps } from './select';

const COPY = uk.devUi.selects.source;

const SOURCE_GROUPS = [
  {
    options: [
      { value: 'djinni', label: SOURCE_LABELS.djinni.labelUk },
      { value: 'dou', label: SOURCE_LABELS.dou.labelUk },
      { value: 'linkedin', label: SOURCE_LABELS.linkedin.labelUk },
    ],
  },
];

function renderSelect(props: Pick<SelectProps, 'value' | 'view'>) {
  const onValueChange = vi.fn();
  render(
    <Field label={COPY.label}>
      <Select groups={SOURCE_GROUPS} onValueChange={onValueChange} {...props} />
    </Field>,
  );
  return { onValueChange, trigger: screen.getByRole('combobox', { name: COPY.label }) };
}

describe('Select', () => {
  it('Enter opens the menu, ArrowDown moves, Enter picks and focus returns to the trigger', async () => {
    const user = userEvent.setup();
    const { onValueChange, trigger } = renderSelect({ value: 'djinni' });

    await user.tab();
    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('dou');
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('Escape closes the menu without a change and gives focus back', async () => {
    const user = userEvent.setup();
    const { onValueChange, trigger } = renderSelect({ value: '' });

    await user.tab();
    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it('the clear button beside the trigger resets the value to the placeholder', async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderSelect({
      value: 'dou',
      view: { placeholder: COPY.placeholder, clearable: true },
    });

    await user.click(screen.getByRole('button', { name: uk.ui.clear }));

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('');
  });

  it('a loading select stays closed on Enter and says it is busy', async () => {
    const user = userEvent.setup();
    const { trigger } = renderSelect({ value: '', view: { status: 'loading' } });

    await user.tab();
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger.getAttribute('aria-busy')).toBe('true');
  });

  it('a disabled select refuses a click', async () => {
    const user = userEvent.setup();
    const { onValueChange, trigger } = renderSelect({ value: '', view: { status: 'disabled' } });

    await user.click(trigger);

    expect(trigger).toHaveProperty('disabled', true);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
