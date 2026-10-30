import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OWNS_ESCAPE, Sheet } from './sheet';

const TITLE = 'Senior React Developer';

function renderSheet() {
  const onClose = vi.fn<() => void>();
  render(
    <Sheet title={TITLE} onClose={onClose}>
      <button type="button">outside</button>
      <form {...OWNS_ESCAPE}>
        <input aria-label="inside" />
      </form>
    </Sheet>,
  );
  return { user: userEvent.setup(), onClose };
}

describe('Sheet', () => {
  it('is a dialog named by its title', () => {
    renderSheet();

    expect(screen.getByRole('dialog', { name: TITLE })).toBeDefined();
  });

  it('Escape closes it', async () => {
    const { user, onClose } = renderSheet();

    screen.getByRole('button', { name: 'outside' }).focus();
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape inside a part that handles Escape itself leaves the sheet open', async () => {
    const { user, onClose } = renderSheet();

    screen.getByRole('textbox', { name: 'inside' }).focus();
    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: TITLE })).toBeDefined();
  });
});
