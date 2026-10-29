import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { Button } from './button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from './dialog';

const COPY = uk.devUi.feedback;

function renderDialog() {
  render(
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">{COPY.openModal}</Button>
      </DialogTrigger>
      <DialogContent header={{ title: COPY.modal.title, description: COPY.modal.description }}>
        <DialogClose asChild>
          <Button>{COPY.modal.save}</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>,
  );
  return screen.getByRole('button', { name: COPY.openModal });
}

describe('Dialog', () => {
  it('opens from the keyboard named by its title and Escape gives focus back', async () => {
    const user = userEvent.setup();
    const trigger = renderDialog();

    await user.tab();
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: COPY.modal.title });
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Tab keeps focus inside, from the close button to the last action and back', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.tab();
    await user.keyboard('{Enter}');
    const close = await screen.findByRole('button', { name: uk.app.close });
    expect(document.activeElement).toBe(close);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: COPY.modal.save }));
    await user.tab();
    expect(document.activeElement).toBe(close);
  });
});
