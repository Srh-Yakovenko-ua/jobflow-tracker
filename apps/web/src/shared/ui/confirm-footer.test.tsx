import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';

import { ConfirmFooter } from './confirm-footer';
import { Dialog, DialogContent } from './dialog';
import { TOUCH_HEIGHT } from './touch-height';

const COPY = uk.applicationPage.deletion;

function renderFooter({ pending, tone }: Readonly<{ pending: boolean; tone?: 'primary' }>) {
  const onConfirm = vi.fn<() => void>();
  const user = userEvent.setup();
  render(
    <Dialog defaultOpen>
      <DialogContent header={{ title: COPY.title }}>
        <ConfirmFooter copy={COPY} action={{ pending, onConfirm, ...(tone && { tone }) }} />
      </DialogContent>
    </Dialog>,
  );
  return { user, onConfirm };
}

describe('ConfirmFooter', () => {
  it('the confirm button runs the action once and leaves the dialog to its owner', async () => {
    const { user, onConfirm } = renderFooter({ pending: false });

    await user.click(screen.getByRole('button', { name: COPY.confirm }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: COPY.title })).toBeDefined();
  });

  it('the cancel button closes the dialog without running the action', async () => {
    const { user, onConfirm } = renderFooter({ pending: false });

    await user.click(screen.getByRole('button', { name: COPY.cancel }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('both buttons grow to the 44 px touch height below md', () => {
    renderFooter({ pending: false });

    const buttons = [COPY.cancel, COPY.confirm].map((name) => screen.getByRole('button', { name }));

    expect(buttons.map((button) => button.classList.contains(TOUCH_HEIGHT))).toEqual([true, true]);
  });

  it('in dark the confirm button leaves the danger tint off the surface-2 footer', () => {
    renderFooter({ pending: false });

    const confirm = screen.getByRole('button', { name: COPY.confirm });

    expect(
      ['dark:bg-transparent', 'dark:not-disabled:hover:bg-surface-3'].map((name) =>
        confirm.classList.contains(name),
      ),
    ).toEqual([true, true]);
  });

  it('a confirm that destroys nothing takes the accent look instead of the danger tint', () => {
    renderFooter({ pending: false, tone: 'primary' });

    const confirm = screen.getByRole('button', { name: COPY.confirm });

    expect(
      ['bg-accent', 'text-danger', 'dark:bg-transparent'].map((name) =>
        confirm.classList.contains(name),
      ),
    ).toEqual([true, false, false]);
  });

  it('while the action runs the confirm button is busy and refuses a second click', async () => {
    const { user, onConfirm } = renderFooter({ pending: true });
    const confirm = screen.getByRole('button', { name: COPY.confirm });

    await user.click(confirm);

    expect(confirm.getAttribute('aria-busy')).toBe('true');
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
