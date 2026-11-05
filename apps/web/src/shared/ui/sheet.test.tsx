import { render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OWNS_ESCAPE, Sheet, SheetClose, useSheetClose } from './sheet';

const TITLE = 'Senior React Developer';

const OPENER = 'Acme card';

type SheetHarnessProps = Readonly<{ open: boolean; onClose: () => void }>;

function DoneButton() {
  const closeSheet = useSheetClose();
  return (
    <button type="button" onClick={closeSheet ?? undefined}>
      done
    </button>
  );
}

function SheetOverOpener({ open, onClose }: SheetHarnessProps) {
  return (
    <>
      <button type="button">{OPENER}</button>
      {open && (
        <Sheet title={TITLE} onClose={onClose}>
          <SheetClose asChild>
            <button type="button">back</button>
          </SheetClose>
          <button type="button">outside</button>
          <DoneButton />
          <form {...OWNS_ESCAPE}>
            <input aria-label="inside" />
          </form>
        </Sheet>
      )}
    </>
  );
}

function renderSheet() {
  const onClose = vi.fn<() => void>();
  const view = render(<SheetOverOpener open={false} onClose={onClose} />);
  const opener = screen.getByRole('button', { name: OPENER });
  opener.focus();
  view.rerender(<SheetOverOpener open onClose={onClose} />);
  return { user: userEvent.setup(), onClose, opener, unmount: view.unmount };
}

const CLOSERS = [
  {
    closer: 'Escape',
    close: async (user: UserEvent) => {
      screen.getByRole('button', { name: 'outside' }).focus();
      await user.keyboard('{Escape}');
    },
  },
  {
    closer: 'the back control',
    close: (user: UserEvent) => user.click(screen.getByRole('button', { name: 'back' })),
  },
  {
    closer: 'a part inside it that is done',
    close: (user: UserEvent) => user.click(screen.getByRole('button', { name: 'done' })),
  },
] as const;

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

  it.each(CLOSERS)(
    'closing with $closer plays out, calls onClose once and hands focus back to the opener',
    async ({ close }) => {
      const { user, onClose, opener } = renderSheet();

      await close(user);

      expect(screen.queryByRole('dialog', { name: TITLE })).toBeNull();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(opener);
    },
  );

  it('a navigation that unmounts the open sheet does not call onClose, so nothing goes back twice', () => {
    const { onClose, unmount } = renderSheet();

    unmount();

    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape inside a part that handles Escape itself leaves the sheet open', async () => {
    const { user, onClose } = renderSheet();

    screen.getByRole('textbox', { name: 'inside' }).focus();
    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: TITLE })).toBeDefined();
  });
});
