import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { Button } from './button';
import {
  AlertDialogContent,
  Dialog,
  DialogClose,
  DialogContent,
  type DialogContentHandlers,
  DialogFooter,
  DialogTrigger,
  keepFocusOnDialog,
} from './dialog';

const COPY = uk.devUi.feedback;

type RenderOptions = Readonly<{
  handlers?: DialogContentHandlers;
  content?: typeof DialogContent;
}>;

function renderDialog({ handlers, content: Content = DialogContent }: RenderOptions = {}) {
  render(
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">{COPY.openModal}</Button>
      </DialogTrigger>
      <Content
        header={{ title: COPY.modal.title, description: COPY.modal.description }}
        {...(handlers && { handlers })}
      >
        <DialogFooter>
          <DialogClose asChild>
            <Button>{COPY.modal.save}</Button>
          </DialogClose>
        </DialogFooter>
      </Content>
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

  it.each([
    { role: 'dialog', content: DialogContent },
    { role: 'alertdialog', content: AlertDialogContent },
  ] as const)(
    '$role is named by its title, described by its body, and Tab keeps focus inside, from the close button to the last action and back',
    async ({ role, content }) => {
      const user = userEvent.setup();
      renderDialog({ content });

      await user.tab();
      await user.keyboard('{Enter}');
      const dialog = await screen.findByRole(role, {
        name: COPY.modal.title,
        description: COPY.modal.description,
      });
      const close = within(dialog).getByRole('button', { name: uk.app.close });
      expect(document.activeElement).toBe(close);

      await user.tab();
      const save = within(dialog).getByRole('button', { name: COPY.modal.save });
      expect(document.activeElement).toBe(save);
      await user.tab();
      expect(document.activeElement).toBe(close);
    },
  );

  it('handlers reach the dialog: the open focus can stay on the dialog, keys typed inside are heard, the close focus is handed over', async () => {
    const user = userEvent.setup();
    const keys: string[] = [];
    const closeFocus: string[] = [];
    const trigger = renderDialog({
      handlers: {
        onOpenAutoFocus: keepFocusOnDialog,
        onKeyDown: (event) => keys.push(event.key),
        onCloseAutoFocus: (event) => {
          event.preventDefault();
          closeFocus.push('handed over');
        },
      },
    });

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: COPY.modal.title });
    expect(document.activeElement).toBe(dialog);
    await user.keyboard('7');
    await user.keyboard('{Escape}');

    expect(keys).toEqual(['7', 'Escape']);
    await screen.findByRole('button', { name: COPY.openModal });
    expect(closeFocus).toEqual(['handed over']);
    expect(document.activeElement).not.toBe(trigger);
  });

  it('the footer is a full-bleed band on the second surface under the content', async () => {
    const user = userEvent.setup();
    await user.click(renderDialog());

    const footer = (await screen.findByRole('button', { name: COPY.modal.save })).parentElement;

    expect([...(footer?.classList ?? [])]).toEqual(
      expect.arrayContaining(['-mx-6', '-mb-6', 'bg-surface-2', 'px-6', 'flex-wrap']),
    );
  });
});
