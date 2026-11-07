import type { MeResponse } from '@jobflow/shared';
import type { ReactNode } from 'react';

import { clearCookie } from '@/shared/lib/cookie';
import { AppShell } from '@/widgets/app-shell';
import { BOARD_DENSITY_COOKIE, KanbanBoard } from '@/widgets/kanban-board';

import { boardRoute, type BoardRouteOptions, DESIGN_BOARD } from './board-fixtures';
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

export function renderBoardInShell(board: BoardRouteOptions = DESIGN_BOARD) {
  clearCookie(BOARD_DENSITY_COOKIE);
  return renderInShell(<KanbanBoard initial={{ density: 'full', filters: {} }} />, { board });
}
