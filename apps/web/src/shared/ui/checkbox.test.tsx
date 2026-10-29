import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';

import { Checkbox } from './checkbox';

const LABELS = uk.devUi.choice.checkboxes;

describe('Checkbox', () => {
  it('Space toggles it from the keyboard and a click on its label toggles it back', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label={LABELS.ghosted} onCheckedChange={onCheckedChange} />);
    const checkbox = screen.getByRole('checkbox', { name: LABELS.ghosted });

    await user.tab();
    await user.keyboard(' ');
    expect(checkbox.getAttribute('aria-checked')).toBe('true');

    await user.click(screen.getByText(LABELS.ghosted));
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
    expect(onCheckedChange.mock.calls).toEqual([[true], [false]]);
  });

  it('a partial state is read as mixed', () => {
    render(<Checkbox label={LABELS.partial} checked="indeterminate" />);

    expect(
      screen.getByRole('checkbox', { name: LABELS.partial }).getAttribute('aria-checked'),
    ).toBe('mixed');
  });

  it('a disabled checkbox refuses a click', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label={LABELS.unavailable} disabled onCheckedChange={onCheckedChange} />);

    await user.click(screen.getByRole('checkbox', { name: LABELS.unavailable }));

    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
