import type {
  ApplicationMatchResponse,
  ApplicationResponse,
  ApplicationTimelineResponse,
  FollowupResponse,
} from '@jobflow/shared';
import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { AppShell } from '@/widgets/app-shell';
import {
  ApplicationPage,
  type ApplicationPageMode,
  ApplicationSheet,
} from '@/widgets/application-page';
import { KanbanBoard } from '@/widgets/kanban-board';

import {
  ACME_APPLICATION,
  applicationRoute,
  type ApplicationRouteOptions,
  deleteRoute,
  updateRoute,
} from './application-fixtures';
import {
  boardRoute,
  type BoardRouteOptions,
  moveRoute,
  type MoveRouteOptions,
  reasonsSummaryRoute,
  undoRoute,
} from './board-fixtures';
import { contactRoutes, type ContactRoutesOptions } from './contact-fixtures';
import { followupRoutes } from './followup-fixtures';
import { LiveUpdates } from './live-stream';
import { matchRoute } from './match-fixtures';
import {
  noteDeleteRoute,
  noteRoute,
  notesRoute,
  type NotesRouteOptions,
  noteUpdateRoute,
} from './note-fixtures';
import { renderViewInApp } from './render-in-app';
import { resumeRoutes, type ResumeRoutesOptions } from './resume-fixtures';
import {
  liveCardOf,
  scheduledEventRoutes,
  type ScheduledEventRoutesOptions,
  type ScheduledEventStore,
} from './scheduled-event-fixtures';
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
  scheduledEvents?: ScheduledEventRoutesOptions;
  board?: BoardRouteOptions;
  contacts?: ContactRoutesOptions;
  match?: ApplicationMatchResponse;
  followup?: FollowupResponse;
  resumes?: ResumeRoutesOptions;
  inShell?: boolean;
  live?: boolean;
};

type ShownPage = Readonly<{
  id: string;
  mode: ApplicationPageMode;
  inShell: boolean;
  live: boolean | undefined;
  wrap: (ui: ReactNode) => ReactNode;
}>;

function shownPage({ id, mode, inShell, live, wrap }: ShownPage) {
  const page =
    mode === 'sheet' ? <ApplicationSheet id={id} /> : <ApplicationPage id={id} view={{ mode }} />;
  const ui = wrap(
    live === true ? (
      <>
        <LiveUpdates />
        {page}
      </>
    ) : (
      page
    ),
  );
  return inShell ? <AppShell initial={{ collapsed: false }}>{ui}</AppShell> : ui;
}

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

type BoardBeside = { board: BoardRouteOptions | undefined; id: string; store: ScheduledEventStore };

function boardBeside({ board, id, store }: BoardBeside) {
  if (board === undefined) return { handlers: [], sent: [], wrap: (ui: ReactNode) => ui };
  const route = boardRoute({ ...board, liveCard: liveCardOf({ applicationId: id, store }) });
  return {
    handlers: [route.handler],
    sent: route.sent,
    wrap: (ui: ReactNode) => (
      <>
        <KanbanBoard initial={{ density: 'full', filters: {} }} />
        {ui}
      </>
    ),
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
  scheduledEvents,
  board,
  contacts,
  match: matchResponse,
  followup: followupResponse,
  resumes,
  inShell = false,
  live,
}: ApplicationPageSetup = {}) {
  const move = moveRoute();
  const undo = undoRoute();
  const patch = updateRoute({ application, ...update });
  const removal = deleteRoute();
  const written = noteRoutes(notes);
  const page = applicationRoute({ application, moves: move.sent, ...(reply && { reply }) });
  const events = scheduledEventRoutes(scheduledEvents);
  const beside = boardBeside({ board, id, store: events.store });
  const recruiters = contactRoutes(contacts);
  const match = matchRoute(matchResponse);
  const versions = resumeRoutes(resumes);
  const followup = followupRoutes({ response: followupResponse });
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
    ...events.handlers,
    ...beside.handlers,
    ...recruiters.handlers,
    match.handler,
    ...versions.handlers,
    ...followup.handlers,
  );
  const ui = shownPage({ id, mode, inShell, live, wrap: beside.wrap });
  const { user, view } = renderViewInApp(ui);
  return {
    user,
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
    scheduledEvents: events.sent,
    board: beside.sent,
    contacts: recruiters.sent,
    match,
    followup,
    resumes: versions.sent,
  };
}

export async function findApplicationTitle(): Promise<HTMLElement> {
  return screen.findByRole('heading', { level: 1, name: ACME_APPLICATION.position });
}
