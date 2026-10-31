import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { Switch } from './switch';

const LABELS = uk.devUi.choice.switches;

describe('Switch', () => {
  it('Space and Enter flip it and the state is read from the switch role', async () => {
    const user = userEvent.setup();
    render(<Switch label={LABELS.push} defaultChecked />);
    const toggle = screen.getByRole('switch', { name: LABELS.push });

    await user.tab();
    await user.keyboard(' ');
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    await user.keyboard('{Enter}');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('placed at the end, the row reads the label first, spans the width and still flips on a click on the text', async () => {
    const user = userEvent.setup();
    render(<Switch label={<span>{LABELS.autoGhost}</span>} placement="end" />);
    const toggle = screen.getByRole('switch', { name: LABELS.autoGhost });
    const row = toggle.closest('label');

    expect(row?.firstElementChild?.textContent).toBe(LABELS.autoGhost);
    expect(row?.lastElementChild).toBe(toggle);
    expect(row?.className).toContain('w-full');
    await user.click(screen.getByText(LABELS.autoGhost));
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('the 26 px track carries the 44 px touch target', () => {
    render(<Switch label={LABELS.autoGhost} />);

    expect(screen.getByRole('switch', { name: LABELS.autoGhost }).className).toContain(
      'touch-target',
    );
  });
});
