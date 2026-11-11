import { LIVE_EVENTS, type LiveEvent, OPEN_STAGES } from '@jobflow/shared';
import { buildJobUpdate } from '@jobflow/shared/testing';
import { type QueryKey, useQuery } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applicationKeys,
  type ApplicationMove,
  jobKeys,
  timelineKeys,
} from '@/entities/application';
import { userKeys } from '@/entities/user';
import { useMoveApplicationMutation } from '@/features/move-application';
import { boardOf, cardIn, DESIGN_BOARD, fixtureIdOf, moveRoute } from '@/test/board-fixtures';
import { liveTicketRoute, stubEventSource } from '@/test/fake-event-source';
import { fakeTimeouts } from '@/test/fake-timeouts';
import { latch } from '@/test/latch';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { LiveUpdates } from './live-updates';

const EVENT_ID = '0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f1a';

const APPLICATION_ID = fixtureIdOf(1);

const JOB = buildJobUpdate({ status: 'processing', step: 2, applicationId: APPLICATION_ID });

const JOB_FRAME: LiveEvent = { id: EVENT_ID, type: LIVE_EVENTS.jobUpdated, data: JOB };

const BOARD = boardOf(DESIGN_BOARD.counts, {
  cards: DESIGN_BOARD.cards ?? [],
  stages: OPEN_STAGES,
});

const MOVE: ApplicationMove = {
  application: cardIn({ serial: 101, stage: 'applied', position: 'Senior Frontend Engineer' }),
  toStage: 'screening',
};

const OPEN = {
  job: jobKeys.detail(JOB.id),
  otherJob: jobKeys.detail('0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a2d'),
  board: applicationKeys.board({}),
  list: applicationKeys.lists(),
  table: applicationKeys.table({}),
  detail: applicationKeys.detail(APPLICATION_ID),
  otherDetail: applicationKeys.detail(fixtureIdOf(2)),
  timeline: timelineKeys.detail(APPLICATION_ID),
  otherTimeline: timelineKeys.detail(fixtureIdOf(2)),
  reasons: applicationKeys.reasonsSummary('rejected'),
  me: userKeys.me(),
} satisfies Record<string, QueryKey>;

type OpenName = keyof typeof OPEN;

const OPEN_NAMES: OpenName[] = [
  'board',
  'detail',
  'job',
  'list',
  'me',
  'otherDetail',
  'otherJob',
  'otherTimeline',
  'reasons',
  'table',
  'timeline',
];

const REFETCHED_ON_RECONNECT: OpenName[] = [
  'board',
  'detail',
  'job',
  'list',
  'otherDetail',
  'otherJob',
  'otherTimeline',
  'reasons',
  'table',
  'timeline',
];

const fetched: OpenName[] = [];

function OpenQuery({ name }: Readonly<{ name: OpenName }>) {
  useQuery({
    queryKey: OPEN[name],
    queryFn: () => {
      fetched.push(name);
      return name === 'board' ? BOARD : name;
    },
  });
  return null;
}

function MoveProbe() {
  const move = useMoveApplicationMutation();
  return (
    <button
      type="button"
      onClick={() => {
        move.mutate(MOVE);
      }}
    >
      {move.status}
    </button>
  );
}

async function pageWithOpenStream(probe?: ReactNode) {
  server.use(liveTicketRoute().handler);
  const stream = stubEventSource();
  const user = renderInApp(
    <>
      <LiveUpdates />
      {OPEN_NAMES.map((name) => (
        <OpenQuery key={name} name={name} />
      ))}
      {probe}
    </>,
  );
  const source = await stream.source(0);
  await waitFor(() => {
    expect([...fetched].sort()).toEqual(OPEN_NAMES);
  });
  act(() => {
    source.open();
  });
  return { stream, source, user };
}

function refetchedAfter(deliver: () => void): OpenName[] {
  fetched.length = 0;
  act(deliver);
  return [...fetched].sort();
}

afterEach(() => {
  fetched.length = 0;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('LiveUpdates', () => {
  it('the first open of the stream refetches nothing', async () => {
    await pageWithOpenStream();

    expect([...fetched].sort()).toEqual(OPEN_NAMES);
  });

  it.each<{ name: string; event: LiveEvent; refetched: OpenName[] }>([
    {
      name: 'job.updated for a job of an application',
      event: JOB_FRAME,
      refetched: ['board', 'detail', 'job', 'list', 'table'],
    },
    {
      name: 'job.updated for a job with no application',
      event: {
        id: EVENT_ID,
        type: LIVE_EVENTS.jobUpdated,
        data: { ...JOB, applicationId: null },
      },
      refetched: ['board', 'job', 'list', 'table'],
    },
    {
      name: 'application.updated',
      event: {
        id: EVENT_ID,
        type: LIVE_EVENTS.applicationUpdated,
        data: { applicationId: APPLICATION_ID, fields: ['isDraft'] },
      },
      refetched: ['board', 'detail', 'list', 'table', 'timeline'],
    },
    {
      name: 'notification.created',
      event: {
        id: EVENT_ID,
        type: LIVE_EVENTS.notificationCreated,
        data: { notificationId: fixtureIdOf(9) },
      },
      refetched: [],
    },
  ])('$name refetches $refetched', async ({ event, refetched }) => {
    const { source } = await pageWithOpenStream();

    expect(
      refetchedAfter(() => {
        source.send(event);
      }),
    ).toEqual(refetched);
  });

  it('a job.updated frame during a pending move refetches the job at once and reads the board once, after the move settles', async () => {
    const held = latch();
    const moves = moveRoute({ latch: held });
    server.use(moves.handler);
    const { source, user } = await pageWithOpenStream(<MoveProbe />);
    await user.click(screen.getByRole('button', { name: 'idle' }));
    await waitFor(() => {
      expect(moves.sent).toHaveLength(1);
    });

    expect(
      refetchedAfter(() => {
        source.send(JOB_FRAME);
      }),
    ).toEqual(['job']);
    held.release();

    expect(await screen.findByRole('button', { name: 'success' })).toBeDefined();
    expect(fetched.filter((name) => name === 'board')).toEqual(['board']);
  });

  it('a reconnect refetches nothing on open, and every open application, job and timeline query and nothing else once it has stayed open 10 s', async () => {
    fakeTimeouts();
    const { stream, source } = await pageWithOpenStream();
    act(() => {
      source.fail();
    });
    await act(() => vi.advanceTimersByTimeAsync(2000));
    const second = await stream.source(1);

    expect(
      refetchedAfter(() => {
        second.open();
      }),
    ).toEqual([]);
    expect(
      refetchedAfter(() => {
        vi.advanceTimersByTime(10_000);
      }),
    ).toEqual(REFETCHED_ON_RECONNECT);
  });
});
