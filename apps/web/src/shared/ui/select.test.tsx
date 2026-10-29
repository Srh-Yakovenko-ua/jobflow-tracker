import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';

import { Field } from './field';
import { Select, type SelectProps } from './select';
import { SOURCE_OPTIONS } from './specimen-options';

const COPY = uk.devUi.selects.source;

const CV = uk.devUi.selects.cv;

const SOURCE_GROUPS = [{ options: SOURCE_OPTIONS }];

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

  it('the clear button beside the trigger resets the value and gives focus to the trigger', async () => {
    const user = userEvent.setup();
    const { onValueChange, trigger } = renderSelect({
      value: 'dou',
      view: { placeholder: COPY.placeholder, clearable: true },
    });

    await user.click(screen.getByRole('button', { name: uk.ui.clear }));

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('');
    expect(document.activeElement).toBe(trigger);
  });

  it('the open menu is a modal dialog named by the field label around a listbox of the same name', async () => {
    const user = userEvent.setup();
    const { trigger } = renderSelect({ value: '' });

    await user.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: COPY.label });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByRole('listbox', { name: COPY.label })).toBeDefined();
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('an option with a detail line carries the detail in its name, so the visible text is in the name', async () => {
    const user = userEvent.setup();
    render(
      <Field label={CV.label}>
        <Select
          groups={[{ options: [{ value: 'cv-v2', ...CV.options.product }] }]}
          value=""
          onValueChange={vi.fn()}
        />
      </Field>,
    );

    await user.click(screen.getByRole('combobox', { name: CV.label }));

    expect(
      await screen.findByRole('option', { name: /27 відгуків · 41% у скринінг/ }),
    ).toBeDefined();
  });

  it('the 38 px trigger carries the 44 px touch target', () => {
    const { trigger } = renderSelect({ value: '' });

    expect(trigger.className).toContain('touch-target');
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
