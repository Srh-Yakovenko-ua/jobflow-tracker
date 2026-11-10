import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog, type ConfirmDialogProps } from './confirm-dialog';

type OnConfirm = ConfirmDialogProps['action']['onConfirm'];

const TRIGGER = { label: 'Вимкнути букмарклет', variant: 'danger' } as const;

const COPY = {
  title: 'Вимкнути букмарклет?',
  body: 'Закладка на панелі перестане працювати.',
  cancel: 'Скасувати',
  confirm: 'Вимкнути',
} as const;

async function openDialog(onConfirm: OnConfirm) {
  const user = userEvent.setup();
  render(<ConfirmDialog trigger={TRIGGER} copy={COPY} action={{ pending: false, onConfirm }} />);
  const trigger = screen.getByRole('button', { name: TRIGGER.label });
  await user.click(trigger);
  const dialog = await screen.findByRole('dialog', { name: COPY.title });
  return { user, trigger, dialog };
}

describe('ConfirmDialog', () => {
  it('stays closed until the trigger is pressed, then shows the title and the body', async () => {
    render(
      <ConfirmDialog
        trigger={TRIGGER}
        copy={COPY}
        action={{ pending: false, onConfirm: () => undefined }}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.setup().click(screen.getByRole('button', { name: TRIGGER.label }));

    expect((await screen.findByRole('dialog', { name: COPY.title })).textContent).toContain(
      COPY.body,
    );
  });

  it('Скасувати closes it and the action never runs', async () => {
    const onConfirm = vi.fn<OnConfirm>();
    const { user } = await openDialog(onConfirm);

    await user.click(screen.getByRole('button', { name: COPY.cancel }));

    expect(onConfirm).toHaveBeenCalledTimes(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('confirm runs the action once and stays open until the action closes it', async () => {
    const onConfirm = vi.fn<OnConfirm>();
    const { user, dialog } = await openDialog(onConfirm);

    await user.click(screen.getByRole('button', { name: COPY.confirm }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(dialog.isConnected).toBe(true);
  });

  it('the action closes it and focus goes back to the trigger', async () => {
    const { user, trigger } = await openDialog((close) => {
      close();
    });

    await user.click(screen.getByRole('button', { name: COPY.confirm }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });
});
