import type { MeResponse } from '@jobflow/shared';
import { screen } from '@testing-library/react';

import { userKeys } from '@/entities/user';
import { KanbanBoard } from '@/widgets/kanban-board';

import { boardRoute, type BoardRouteOptions, reasonsSummaryRoute } from './board-fixtures';
import { QueryProbe } from './query-status';
import { renderInApp } from './render-in-app';
import { server } from './server';
import { meRoute } from './session-fixtures';

export type BoardSettings = Partial<MeResponse['settings']>;

export function renderBoard(route: BoardRouteOptions, settings?: BoardSettings) {
  const board = boardRoute(route);
  server.use(meRoute(settings), board.handler, reasonsSummaryRoute().handler);
  const user = renderInApp(
    <>
      <KanbanBoard />
      <QueryProbe queryKey={userKeys.me()} />
    </>,
  );
  return { user, sent: board.sent };
}

export function columnNamed(name: string): HTMLElement {
  const column = screen.getByRole('heading', { name }).closest('section');
  if (column === null) {
    throw new Error(`no column is headed "${name}"`);
  }
  return column;
}
