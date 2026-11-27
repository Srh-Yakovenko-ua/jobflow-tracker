import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PAGE_HEADING_ID } from '@/shared/lib/page-heading';

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

type GoneOpenerProps = Readonly<{ open: boolean; openerShown: boolean }>;

function SheetOverGoneOpener({ open, openerShown }: GoneOpenerProps) {
  return (
    <>
      <h1 id={PAGE_HEADING_ID} tabIndex={-1}>
        Дошка
      </h1>
      {openerShown && <button type="button">{OPENER}</button>}
      {open && (
        <Sheet title={TITLE} onClose={vi.fn<() => void>()}>
          <DoneButton />
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

  it('closing after the opener left the page, as a deleted card does, hands focus to the page heading', async () => {
    const view = render(<SheetOverGoneOpener open={false} openerShown />);
    screen.getByRole('button', { name: OPENER }).focus();
    view.rerender(<SheetOverGoneOpener open openerShown />);
    view.rerender(<SheetOverGoneOpener open openerShown={false} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'done' }));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Дошка' }));
    });
  });
});
