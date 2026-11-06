import type { ApplicationResponse, ApplicationTimelineResponse } from '@jobflow/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  ApplicationPage,
  type ApplicationPageMode,
  ApplicationSheet,
} from '@/widgets/application-page';

import {
  ACME_APPLICATION,
  applicationRoute,
  type ApplicationRouteOptions,
  deleteRoute,
  updateRoute,
} from './application-fixtures';
import { moveRoute, type MoveRouteOptions, reasonsSummaryRoute, undoRoute } from './board-fixtures';
import {
  noteDeleteRoute,
  noteRoute,
  notesRoute,
  type NotesRouteOptions,
  noteUpdateRoute,
} from './note-fixtures';
import { InApp } from './render-in-app';
import { server } from './server';
import { meRoute } from './session-fixtures';
import { EMPTY_TIMELINE, timelineRoute } from './timeline-fixtures';

export type ApplicationPageSetup = Partial<Pick<ApplicationRouteOptions, 'reply'>> & {
  application?: ApplicationResponse;
  id?: string;
  mode?: ApplicationPageMode;
  update?: MoveRouteOptions;
  notes?: NotesRouteOptions;
  timeline?: ApplicationTimelineResponse;
};

function noteRoutes(notes: NotesRouteOptions) {
  const listed = notesRoute(notes);
  const added = noteRoute();
  const updated = noteUpdateRoute();
  const deleted = noteDeleteRoute();
  return {
    handlers: [listed.handler, added.handler, updated.handler, deleted.handler],
    sent: { listed: listed.sent, added: added.sent, updated: updated.sent, deleted: deleted.sent },
  };
}

export function renderApplicationPage({
  application = ACME_APPLICATION,
  id = application.id,
  reply,
  mode = 'page',
  update = {},
  notes = {},
  timeline = EMPTY_TIMELINE,
}: ApplicationPageSetup = {}) {
  const move = moveRoute();
  const undo = undoRoute();
  const patch = updateRoute({ application, ...update });
  const removal = deleteRoute();
  const written = noteRoutes(notes);
  const page = applicationRoute({ application, moves: move.sent, ...(reply && { reply }) });
  server.use(
    meRoute(),
    page.handler,
    move.handler,
    undo.handler,
    patch.handler,
    removal.handler,
    reasonsSummaryRoute().handler,
    timelineRoute({ timeline }),
    ...written.handlers,
  );
  const ui =
    mode === 'sheet' ? <ApplicationSheet id={id} /> : <ApplicationPage id={id} view={{ mode }} />;
  const view = render(ui, { wrapper: InApp });
  return {
    user: userEvent.setup(),
    reopen: () => {
      view.rerender(null);
      view.rerender(ui);
    },
    sent: page.sent,
    moves: move.sent,
    undone: undo.sent,
    updates: patch.sent,
    deletes: removal.sent,
    notes: written.sent,
  };
}

export async function findApplicationTitle(): Promise<HTMLElement> {
  return screen.findByRole('heading', { level: 1, name: ACME_APPLICATION.position });
}
