import type { ApplicationFilters, MeResponse } from '@jobflow/shared';
import { screen } from '@testing-library/react';

import { userKeys } from '@/entities/user';
import { KanbanBoard } from '@/widgets/kanban-board';

import { layOutColumns } from './board-drag';
import {
  boardRoute,
  type BoardRouteOptions,
  DESIGN_BOARD,
  moveRoute,
  type MoveRouteOptions,
  reasonsSummaryRoute,
} from './board-fixtures';
import { QueryProbe, waitForQuery } from './query-status';
import { renderInApp } from './render-in-app';
import { server } from './server';
import { meRoute } from './session-fixtures';

export type BoardSettings = Partial<MeResponse['settings']>;

export type DragSetup = {
  board?: BoardRouteOptions;
  move?: MoveRouteOptions;
  settings?: BoardSettings;
};

export type BoardRenderOptions = {
  settings?: BoardSettings | undefined;
  filters?: ApplicationFilters;
};

export function renderBoard(
  route: BoardRouteOptions,
  { settings, filters = {} }: BoardRenderOptions = {},
) {
  const board = boardRoute(route);
  server.use(meRoute(settings), board.handler, reasonsSummaryRoute().handler);
  const user = renderInApp(
    <>
      <KanbanBoard initial={{ density: 'full', filters }} />
      <QueryProbe queryKey={userKeys.me()} />
    </>,
  );
  return { user, sent: board.sent };
}

export async function boardReadyToDrag({ board = DESIGN_BOARD, move, settings }: DragSetup = {}) {
  const moves = moveRoute(move);
  server.use(moves.handler);
  const { user, sent } = renderBoard(board, { settings });
  await screen.findAllByRole('heading');
  await waitForQuery({ queryKey: userKeys.me(), status: 'success' });
  layOutColumns();
  return { user, moves: moves.sent, boardSent: sent };
}

export function columnNamed(name: string): HTMLElement {
  const column = screen.getByRole('heading', { name }).closest('section');
  if (column === null) {
    throw new Error(`no column is headed "${name}"`);
  }
  return column;
}
