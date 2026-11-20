import type { BoardCard } from '@jobflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { describe, expect, it } from 'vitest';

import { applicationKeys } from '@/entities/application';
import { apiUrl, errorReply, rateLimitedReply } from '@/test/api-handlers';
import { fixtureIdOf, ghostIn } from '@/test/board-fixtures';
import {
  acceptedFollowup,
  followupJob,
  followupRoutes,
  type FollowupRoutesOptions,
  NO_FOLLOWUP,
  READY_FOLLOWUP,
} from '@/test/followup-fixtures';
import { latch } from '@/test/latch';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { useBulkFollowups } from './use-bulk-followups';

const GHOSTS: readonly BoardCard[] = [
  ghostIn({ serial: 201, days: 10 }),
  ghostIn({ serial: 202, days: 20 }),
  ghostIn({ serial: 203, days: 30 }),
];

function renderQueue(options: Pick<FollowupRoutesOptions, 'generateReply' | 'responseOf'> = {}) {
  const routes = followupRoutes({ response: { ...NO_FOLLOWUP, language: 'en' }, ...options });
  server.use(...routes.handlers);
  const view = renderHookInApp(() => useBulkFollowups());
  act(() => {
    view.result.current.start(GHOSTS);
  });
  const states = () => view.result.current.rows.map((row) => row.state);
  return { view, sent: routes.sent, states };
}

type SettledQueue = Pick<ReturnType<typeof renderQueue>, 'sent' | 'states'>;

async function postedOnceAllSent({ sent, states }: SettledQueue) {
  await waitFor(() => {
    expect(states()).toEqual(['sent', 'sent', 'sent']);
  });
  return sent.posted.map((request) => request.id);
}

function heldLanguageRoute() {
  const held = latch();
  const asked: string[] = [];
  server.use(
    http.get<{ id: string }>(apiUrl('/applications/:id/followup'), async ({ params }) => {
      asked.push(params.id);
      await held.reached;
      return HttpResponse.json({ ...NO_FOLLOWUP, language: 'en' });
    }),
  );
  return { held, asked };
}

function renderHeldQueue() {
  const held = latch();
  const queue = renderQueue({
    generateReply: async () => {
      await held.reached;
      return acceptedFollowup();
    },
  });
  return { ...queue, held };
}

describe('useBulkFollowups', () => {
  it('asks one neutral draft per fresh ghost, in order, the next only after the 202, and sends nothing', async () => {
    const { held, sent, states } = renderHeldQueue();

    await waitFor(() => {
      expect(sent.posted).toHaveLength(1);
    });
    expect(states()).toEqual(['queued', 'queued', 'queued']);
    held.release();

    expect(await postedOnceAllSent({ sent, states })).toEqual(GHOSTS.map((card) => card.id));
    expect(sent.requested).toEqual(
      Array.from({ length: 3 }, () => ({ tone: 'neutral', language: 'en', variant: false })),
    );
    expect(new Set(sent.posted.map((request) => request.idempotencyKey)).size).toBe(3);
    expect(sent.marked).toEqual([]);
  });

  it('a 429 stops the queue and turns that row and every unsent row to the manual path', async () => {
    const { view, sent, states } = renderQueue({
      generateReply: ({ params }) =>
        params.id === fixtureIdOf(202)
          ? rateLimitedReply({ 'Retry-After': '60' })
          : acceptedFollowup(),
    });

    await waitFor(() => {
      expect(states()).toEqual(['sent', 'manual', 'manual']);
    });
    expect(sent.posted.map((request) => request.id)).toEqual([fixtureIdOf(201), fixtureIdOf(202)]);
    expect(view.result.current.running).toBe(false);
  });

  it.each([
    ['a draft', READY_FOLLOWUP],
    ['a running job', followupJob('processing')],
  ])('re-expanding the lane queues no ghost that has %s', async (_held, response) => {
    const queue = renderQueue({
      responseOf: (id) => (id === fixtureIdOf(202) ? response : undefined),
    });

    expect(await postedOnceAllSent(queue)).toEqual([fixtureIdOf(201), fixtureIdOf(203)]);
  });

  it('a skipped ghost is never posted and leaves the list', async () => {
    const { held, view, sent, states } = renderHeldQueue();
    await waitFor(() => {
      expect(sent.posted).toHaveLength(1);
    });

    act(() => {
      view.result.current.skip(fixtureIdOf(202));
    });
    held.release();

    await waitFor(() => {
      expect(states()).toEqual(['sent', 'sent']);
    });
    expect(sent.posted.map((request) => request.id)).toEqual([fixtureIdOf(201), fixtureIdOf(203)]);
  });

  it('keeps posting when the row panels cancel the shared followup query while it loads', async () => {
    const routes = followupRoutes({});
    server.use(...routes.handlers);
    const language = heldLanguageRoute();
    const view = renderHookInApp(() => ({ queue: useBulkFollowups(), client: useQueryClient() }));
    act(() => {
      view.result.current.queue.start(GHOSTS);
    });
    await waitFor(() => {
      expect(language.asked).toHaveLength(1);
    });

    await act(() =>
      view.result.current.client.cancelQueries({
        queryKey: applicationKeys.ai(fixtureIdOf(201), 'followup'),
      }),
    );
    language.held.release();

    const states = () => view.result.current.queue.rows.map((row) => row.state);
    await waitFor(() => {
      expect(states()).toEqual(['sent', 'sent', 'sent']);
    });
    expect(routes.sent.posted.map((request) => request.id)).toEqual(GHOSTS.map((card) => card.id));
  });

  it('a failure that is not a rate limit leaves that row open to retry and goes on', async () => {
    const { sent, states } = renderQueue({
      generateReply: ({ params }) =>
        params.id === fixtureIdOf(202)
          ? errorReply({ status: 500, type: 'internal_error' })
          : acceptedFollowup(),
    });

    await waitFor(() => {
      expect(states()).toEqual(['sent', 'failed', 'sent']);
    });
    expect(sent.posted.map((request) => request.id)).toEqual(GHOSTS.map((card) => card.id));
  });

  it('posts nothing more once the hook unmounts', async () => {
    const { held, view, sent } = renderHeldQueue();
    await waitFor(() => {
      expect(sent.posted).toHaveLength(1);
    });

    view.unmount();
    held.release();

    await expect(
      waitFor(
        () => {
          expect(sent.posted.length).toBeGreaterThan(1);
        },
        { timeout: 300 },
      ),
    ).rejects.toThrow();
  });
});
