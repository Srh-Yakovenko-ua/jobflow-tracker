import type { ApplicationResponse } from '@jobflow/shared';
import { screen } from '@testing-library/react';

import { ApplicationPage, type ApplicationPageMode } from '@/widgets/application-page';

import {
  ACME_APPLICATION,
  applicationRoute,
  type ApplicationRouteOptions,
  deleteRoute,
  updateRoute,
} from './application-fixtures';
import { moveRoute, type MoveRouteOptions, reasonsSummaryRoute, undoRoute } from './board-fixtures';
import { renderInApp } from './render-in-app';
import { server } from './server';
import { meRoute } from './session-fixtures';
import { EMPTY_TIMELINE, timelineRoute } from './timeline-fixtures';

export type ApplicationPageSetup = Partial<Pick<ApplicationRouteOptions, 'reply'>> & {
  application?: ApplicationResponse;
  id?: string;
  mode?: ApplicationPageMode;
  update?: MoveRouteOptions;
};

export function renderApplicationPage({
  application = ACME_APPLICATION,
  id = application.id,
  reply,
  mode = 'page',
  update = {},
}: ApplicationPageSetup = {}) {
  const move = moveRoute();
  const undo = undoRoute();
  const patch = updateRoute({ application, ...update });
  const removal = deleteRoute();
  const page = applicationRoute({ application, moves: move.sent, ...(reply && { reply }) });
  server.use(
    meRoute(),
    page.handler,
    move.handler,
    undo.handler,
    patch.handler,
    removal.handler,
    reasonsSummaryRoute().handler,
    timelineRoute({ timeline: EMPTY_TIMELINE }),
  );
  const user = renderInApp(<ApplicationPage id={id} view={{ mode }} />);
  return {
    user,
    sent: page.sent,
    moves: move.sent,
    undone: undo.sent,
    updates: patch.sent,
    deletes: removal.sent,
  };
}

export async function findApplicationTitle(): Promise<HTMLElement> {
  return screen.findByRole('heading', { level: 1, name: ACME_APPLICATION.position });
}
