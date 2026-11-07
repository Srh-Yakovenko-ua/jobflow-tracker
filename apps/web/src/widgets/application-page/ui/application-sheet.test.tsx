import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ACME_APPLICATION, applicationRoute } from '@/test/application-fixtures';
import { holdExitAnimations } from '@/test/held-exits';
import { back } from '@/test/navigation';
import { notesRoute } from '@/test/note-fixtures';
import { renderApplicationPage } from '@/test/render-application-page';
import { renderInApp, renderViewInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';
import { EMPTY_TIMELINE, timelineRoute } from '@/test/timeline-fixtures';

import { ApplicationSheet } from './application-sheet';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const BOARD_CARD = 'Acme card';

function serveSheet() {
  server.use(
    meRoute(),
    applicationRoute({ application: ACME_APPLICATION }).handler,
    timelineRoute({ timeline: EMPTY_TIMELINE }),
    notesRoute().handler,
  );
}

function renderSheet() {
  serveSheet();
  return renderInApp(<ApplicationSheet id={ACME_APPLICATION.id} />);
}

function BoardUnderSheet({ open }: Readonly<{ open: boolean }>) {
  return (
    <>
      <a href={`/applications/${ACME_APPLICATION.id}`}>{BOARD_CARD}</a>
      {open && <ApplicationSheet id={ACME_APPLICATION.id} />}
    </>
  );
}

const CLOSERS = [
  { closer: 'Escape', close: (user: UserEvent) => user.keyboard('{Escape}') },
  {
    closer: 'Дошка',
    close: async (user: UserEvent) => user.click(screen.getByRole('button', { name: 'Дошка' })),
  },
] as const;

afterEach(() => {
  back.mockClear();
  vi.restoreAllMocks();
});

describe('ApplicationSheet', () => {
  it('opens over the board named by the position', async () => {
    renderSheet();

    expect(await screen.findByRole('dialog', { name: 'Senior React Developer' })).toBeDefined();
  });

  it('Escape goes back to the board', async () => {
    const user = renderSheet();
    await screen.findByRole('dialog', { name: 'Senior React Developer' });

    await user.keyboard('{Escape}');

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('Escape in the editor closes only the editor and keeps the sheet open', async () => {
    const user = renderSheet();
    await user.click(await screen.findByRole('button', { name: 'Senior React Developer' }));
    await screen.findByRole('textbox', { name: 'Посада' });

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('textbox', { name: 'Посада' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Senior React Developer' })).toBeDefined();
    expect(back).not.toHaveBeenCalled();
  });

  it('Дошка in the top bar goes back to the board instead of loading it again', async () => {
    const user = renderSheet();

    await user.click(await screen.findByRole('button', { name: 'Дошка' }));

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('a delete plays the sheet exit with the application still shown, then goes back once', async () => {
    const exits = holdExitAnimations();
    const { user, deletes } = renderApplicationPage({ mode: 'sheet' });
    const sheet = await screen.findByRole('dialog', { name: ACME_APPLICATION.position });

    await user.click(await within(sheet).findByRole('button', { name: 'Ще дії' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Видалити' }));
    exits.finish();
    const confirm = await screen.findByRole('dialog', { name: 'Видалити картку?' });
    await user.click(within(confirm).getByRole('button', { name: 'Видалити' }));

    await waitFor(() => {
      expect(sheet.dataset.state).toBe('closed');
    });
    const title = { level: 1, name: ACME_APPLICATION.position, hidden: true } as const;
    expect(within(sheet).getByRole('heading', title)).toBeDefined();
    expect(back).not.toHaveBeenCalled();
    exits.finish();
    expect(sheet.isConnected).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
    expect(deletes).toEqual([ACME_APPLICATION.id]);
  });

  it.each(CLOSERS)(
    'closing with $closer hands focus back to the board card that opened the sheet',
    async ({ close }) => {
      serveSheet();
      const { user, view } = renderViewInApp(<BoardUnderSheet open={false} />);
      const card = screen.getByRole('link', { name: BOARD_CARD });
      card.focus();
      view.rerender(<BoardUnderSheet open />);
      await screen.findByRole('heading', { level: 1, name: ACME_APPLICATION.position });

      await close(user);
      expect(back).toHaveBeenCalledTimes(1);
      view.rerender(<BoardUnderSheet open={false} />);

      await waitFor(() => {
        expect(document.activeElement).toBe(card);
      });
    },
  );
});
