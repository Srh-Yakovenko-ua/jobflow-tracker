import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ACME_APPLICATION, applicationRoute } from '@/test/application-fixtures';
import { back } from '@/test/navigation';
import { InApp, renderInApp } from '@/test/render-in-app';
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

  it.each(CLOSERS)(
    'closing with $closer hands focus back to the board card that opened the sheet',
    async ({ close }) => {
      serveSheet();
      const { rerender } = render(<BoardUnderSheet open={false} />, { wrapper: InApp });
      const user = userEvent.setup();
      const card = screen.getByRole('link', { name: BOARD_CARD });
      card.focus();
      rerender(<BoardUnderSheet open />);
      await screen.findByRole('heading', { level: 1, name: ACME_APPLICATION.position });

      await close(user);
      expect(back).toHaveBeenCalledTimes(1);
      rerender(<BoardUnderSheet open={false} />);

      await waitFor(() => {
        expect(document.activeElement).toBe(card);
      });
    },
  );
});
