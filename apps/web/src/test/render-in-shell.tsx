import type { MeResponse } from '@jobflow/shared';
import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { userKeys } from '@/entities/user';
import { clearCookie } from '@/shared/lib/cookie';
import { AppShell } from '@/widgets/app-shell';
import { BOARD_DENSITY_COOKIE, KanbanBoard } from '@/widgets/kanban-board';

import { boardRoute, type BoardRouteOptions, DESIGN_BOARD } from './board-fixtures';
import { QueryProbe, waitForQuery } from './query-status';
import { renderInApp } from './render-in-app';
import { server } from './server';
import { meRoute } from './session-fixtures';

export type ShellSetup = Readonly<{
  board?: BoardRouteOptions;
  settings?: Partial<MeResponse['settings']>;
}>;

export function renderInShell(
  page: ReactNode = null,
  { board = DESIGN_BOARD, settings = {} }: ShellSetup = {},
) {
  server.use(meRoute(settings), boardRoute(board).handler);
  return renderInApp(<AppShell initial={{ collapsed: false }}>{page}</AppShell>);
}

export async function renderSignedIn(page: ReactNode, shell: ShellSetup = {}) {
  const user = renderInShell(
    <>
      {page}
      <QueryProbe queryKey={userKeys.me()} />
    </>,
    shell,
  );
  await waitForQuery({ queryKey: userKeys.me(), status: 'success' });
  return user;
}

export async function openPalette(user: UserEvent) {
  await user.keyboard('{Control>}k{/Control}');
  return screen.findByRole('dialog', { name: 'Палітра команд' });
}

export async function choose(user: UserEvent, label: string) {
  await openPalette(user);
  await user.keyboard(label);
  await screen.findByRole('option', { name: label });
  await user.keyboard('{Enter}');
}

export function renderBoardInShell(board: BoardRouteOptions = DESIGN_BOARD) {
  clearCookie(BOARD_DENSITY_COOKIE);
  return renderInShell(<KanbanBoard initial={{ density: 'full', filters: {} }} />, { board });
}
