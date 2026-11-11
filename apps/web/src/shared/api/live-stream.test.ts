import { LIVE_EVENTS, type LiveEvent } from '@jobflow/shared';
import { buildJobUpdate } from '@jobflow/shared/testing';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { RequestHandler } from 'msw';
import { http } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { errorReply, recordSentRequests } from '@/test/api-handlers';
import {
  LIVE_TICKET_URL,
  liveTicketRoute,
  streamUrlFor,
  stubEventSource,
} from '@/test/fake-event-source';
import { fakeTimeouts } from '@/test/fake-timeouts';
import { latch } from '@/test/latch';
import { server } from '@/test/server';

import { apiClient } from './clients';
import { openLiveStream, useLiveConnected } from './live-stream';

const JOB_DONE: LiveEvent = {
  id: '0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f1a',
  type: LIVE_EVENTS.jobUpdated,
  data: buildJobUpdate({ status: 'done', step: 3 }),
};

const opened: (() => void)[] = [];

function connect(...before: RequestHandler[]) {
  const tickets = liveTicketRoute();
  server.use(...before, tickets.handler);
  const stream = stubEventSource();
  const onEvent = vi.fn<(event: LiveEvent) => void>();
  const onReconnect = vi.fn<() => void>();
  const close = openLiveStream({ onEvent, onReconnect });
  opened.push(close);
  return { tickets, stream, onEvent, onReconnect, close };
}

function wait(ms: number) {
  return vi.advanceTimersByTimeAsync(ms);
}

afterEach(() => {
  opened.splice(0).forEach((close) => {
    close();
  });
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('openLiveStream', () => {
  it('opens the stream with the ticket it asked for and hands a job.updated frame over as a parsed event', async () => {
    const { stream, onEvent } = connect();
    const source = await stream.source(0);

    source.open();
    source.send(JOB_DONE);

    expect(stream.urls()).toEqual([streamUrlFor('ticket-1')]);
    expect(onEvent.mock.calls).toEqual([[JOB_DONE]]);
  });

  it('drops a frame that is not JSON or does not fit the event schema, and keeps delivering', async () => {
    const { stream, onEvent } = connect();
    const source = await stream.source(0);
    source.open();

    source.sendText({ id: JOB_DONE.id, type: JOB_DONE.type, text: 'not json' });
    source.sendText({ id: JOB_DONE.id, type: JOB_DONE.type, text: '{"status":"paused"}' });
    expect(onEvent).not.toHaveBeenCalled();
    source.send(JOB_DONE);

    expect(onEvent).toHaveBeenCalledExactlyOnceWith(JOB_DONE);
  });

  it('a refused connect closes the source and retries 2 s later with a second ticket', async () => {
    fakeTimeouts();
    const { stream, tickets } = connect();
    const refused = await stream.source(0);

    refused.fail();
    expect(refused.closed).toBe(true);
    expect(tickets.issued).toEqual(['ticket-1']);
    await wait(2000);
    await stream.source(1);

    expect(stream.urls()).toEqual([streamUrlFor('ticket-1'), streamUrlFor('ticket-2')]);
  });

  it('a source that has not opened in 10 s is closed and replaced through a new ticket', async () => {
    fakeTimeouts();
    const { stream } = connect();
    const hanging = await stream.source(0);

    await wait(9000);
    expect(hanging.closed).toBe(false);
    await wait(1000);
    expect(hanging.closed).toBe(true);
    await wait(2000);

    expect((await stream.source(1)).url).toBe(streamUrlFor('ticket-2'));
  });

  it('a source that opened is left alone past the 10 s connect limit', async () => {
    fakeTimeouts();
    const { stream, tickets } = connect();
    const source = await stream.source(0);

    source.open();
    await wait(12_000);

    expect(source.closed).toBe(false);
    expect(tickets.issued).toEqual(['ticket-1']);
  });

  it('doubles the wait after each failed connect and starts from 2 s again once an opened stream has delivered a frame', async () => {
    fakeTimeouts();
    const { stream, tickets } = connect();
    (await stream.source(0)).fail();
    await wait(2000);
    (await stream.source(1)).fail();

    await wait(2000);
    expect(tickets.issued).toHaveLength(2);
    await wait(2000);
    const third = await stream.source(2);
    third.open();
    third.send(JOB_DONE);
    third.fail();
    await wait(2000);

    expect((await stream.source(3)).url).toBe(streamUrlFor('ticket-4'));
  });

  it('a stream that opens and then errors three times in a row waits 2 s, 4 s and 8 s, and never calls onReconnect', async () => {
    fakeTimeouts();
    const { stream, tickets, onReconnect } = connect();
    for (const [index, pause] of [2000, 4000, 8000].entries()) {
      const source = await stream.source(index);
      source.open();
      source.fail();
      await wait(pause - 1000);
      expect(tickets.issued).toHaveLength(index + 1);
      await wait(1000);
    }

    expect((await stream.source(3)).url).toBe(streamUrlFor('ticket-4'));
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('never waits longer than 30 s between connects', async () => {
    fakeTimeouts();
    const { stream } = connect();
    for (const [index, pause] of [2000, 4000, 8000, 16_000, 30_000].entries()) {
      (await stream.source(index)).fail();
      await wait(pause);
    }

    expect((await stream.source(5)).url).toBe(streamUrlFor('ticket-6'));
  });

  it('a refused ticket request is retried 2 s later', async () => {
    fakeTimeouts();
    const refuse = vi.fn(() => errorReply({ status: 503, type: 'not_ready' }));
    const { stream } = connect(http.post(LIVE_TICKET_URL, refuse, { once: true }));
    await waitFor(() => {
      expect(refuse).toHaveBeenCalledTimes(1);
    });

    expect(stream.all).toEqual([]);
    await wait(2000);

    expect((await stream.source(0)).url).toBe(streamUrlFor('ticket-1'));
  });

  it('calls onReconnect once a reopened stream has stayed open 10 s, never for the first open', async () => {
    fakeTimeouts();
    const { stream, onReconnect } = connect();
    const first = await stream.source(0);

    first.open();
    expect(onReconnect).not.toHaveBeenCalled();
    first.fail();
    await wait(2000);
    (await stream.source(1)).open();
    await wait(10_000);

    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('a reopened stream that delivers a frame calls onReconnect once, and the settle timer does not call it again', async () => {
    fakeTimeouts();
    const { stream, onReconnect } = connect();
    const first = await stream.source(0);
    first.open();
    first.fail();
    await wait(2000);
    const reopened = await stream.source(1);

    reopened.open();
    reopened.send(JOB_DONE);
    expect(onReconnect).toHaveBeenCalledTimes(1);
    await wait(10_000);

    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('closing a stream that has not opened yet closes its source and sends nothing more', async () => {
    fakeTimeouts();
    const sentRequests = recordSentRequests();
    const { stream, close } = connect();
    const source = await stream.source(0);

    close();
    await wait(60_000);

    expect(source.closed).toBe(true);
    expect(sentRequests()).toHaveLength(1);
  });

  it('closing while it waits to retry asks for no more tickets', async () => {
    fakeTimeouts();
    const sentRequests = recordSentRequests();
    const { stream, close } = connect();
    (await stream.source(0)).fail();

    close();
    await wait(60_000);

    expect(sentRequests()).toHaveLength(1);
  });

  it('a stream closed before its ticket arrived never opens a source', async () => {
    fakeTimeouts();
    const { stream, tickets, close } = connect();
    close();
    opened.push(openLiveStream({ onEvent: vi.fn(), onReconnect: vi.fn() }));

    (await stream.source(0)).fail();
    await wait(2000);
    await stream.source(1);

    expect(tickets.issued).toHaveLength(3);
    expect(stream.all).toHaveLength(2);
  });
});

describe('useLiveConnected', () => {
  it('is true while a stream is open and false again once it errors', async () => {
    const { stream } = connect();
    const { result } = renderHook(() => useLiveConnected());
    const source = await stream.source(0);

    expect(result.current).toBe(false);
    act(() => {
      source.open();
    });
    expect(result.current).toBe(true);
    act(() => {
      source.fail();
    });

    expect(result.current).toBe(false);
  });

  it('stays true for a second open stream when a closed stream has its ticket request refused late', async () => {
    const held = latch();
    const asked = vi.spyOn(apiClient, 'request');
    const refuse = vi.fn(async () => {
      await held.reached;
      return errorReply({ status: 503, type: 'not_ready' });
    });
    const closed = connect(http.post(LIVE_TICKET_URL, refuse, { once: true }));
    await waitFor(() => {
      expect(refuse).toHaveBeenCalledTimes(1);
    });
    closed.close();
    const { stream } = connect();
    const { result } = renderHook(() => useLiveConnected());
    const source = await stream.source(0);
    act(() => {
      source.open();
    });

    const ticketRequests = asked.mock.results.map((result): unknown => result.value);
    held.release();
    await act(() => Promise.allSettled(ticketRequests));

    expect(result.current).toBe(true);
  });
});
