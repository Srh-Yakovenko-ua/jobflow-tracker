import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Plus } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';

import { Button } from './button';

const LABELS = uk.devUi.buttons;

describe('Button', () => {
  it('Enter and Space press it from the keyboard', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>{LABELS.addVacancy}</Button>);

    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('loading keeps the label, marks the button busy and refuses a click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        {LABELS.variants.loading}
      </Button>,
    );

    const button = screen.getByRole('button', { name: LABELS.variants.loading });
    await user.click(button);

    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button).toHaveProperty('disabled', true);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('an icon-only button is named by its label and shows it as a tooltip on focus', async () => {
    const user = userEvent.setup();
    render(
      <Button variant="secondary" icon={<Plus aria-hidden />} aria-label={LABELS.addVacancy} />,
    );

    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole('button', { name: LABELS.addVacancy }));
    expect((await screen.findByRole('tooltip')).textContent).toBe(LABELS.addVacancy);
  });
});
