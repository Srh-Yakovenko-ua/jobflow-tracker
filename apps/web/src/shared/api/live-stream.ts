'use client';

import {
  LIVE_EVENTS,
  LIVE_LIMITS,
  type LiveEvent,
  liveEventSchema,
  liveTicketSchema,
} from '@jobflow/shared';
import { useSyncExternalStore } from 'react';

import { config } from '@/shared/config';
import { createListeners } from '@/shared/lib/listeners';

import { apiClient } from './clients';

export const LIVE_CLIENT_LIMITS = {
  connectTimeoutMs: 10_000,
  retryMinMs: 2_000,
  retryMaxMs: 30_000,
  slowPollMs: 10_000,
} as const;

export type LiveStreamHandlers = Readonly<{
  onEvent: (event: LiveEvent) => void;
  onReconnect: () => void;
}>;

type LiveStream = {
  handlers: LiveStreamHandlers;
  closed: boolean;
  everOpened: boolean;
  unsettled: 'first' | 'reopened' | undefined;
  retryMs: number;
  source: EventSource | undefined;
  timer: ReturnType<typeof setTimeout> | undefined;
};

const TICKET_REQUEST = {
  path: '/events/ticket',
  method: 'POST',
  schema: liveTicketSchema,
} as const;

const openStreams = new Set<LiveStream>();

const { subscribe, notify } = createListeners();

function isConnected(): boolean {
  return openStreams.size > 0;
}

function raise(stream: LiveStream): void {
  const wasConnected = isConnected();
  openStreams.add(stream);
  if (!wasConnected) notify();
}

function lower(stream: LiveStream): void {
  if (openStreams.delete(stream) && !isConnected()) notify();
}

function notConnectedOnServer(): boolean {
  return false;
}

function drop(stream: LiveStream): void {
  clearTimeout(stream.timer);
  stream.source?.close();
  stream.source = undefined;
  stream.unsettled = undefined;
  lower(stream);
}

function retryLater(stream: LiveStream): void {
  drop(stream);
  if (stream.closed) return;
  stream.timer = setTimeout(() => {
    void connect(stream);
  }, stream.retryMs);
  stream.retryMs = Math.min(stream.retryMs * 2, LIVE_CLIENT_LIMITS.retryMaxMs);
}

function settle(stream: LiveStream): void {
  const { unsettled } = stream;
  if (unsettled === undefined) return;
  clearTimeout(stream.timer);
  stream.unsettled = undefined;
  stream.retryMs = LIVE_CLIENT_LIMITS.retryMinMs;
  if (unsettled === 'reopened') {
    stream.handlers.onReconnect();
  }
}

function markOpen(stream: LiveStream): void {
  clearTimeout(stream.timer);
  raise(stream);
  stream.unsettled = stream.everOpened ? 'reopened' : 'first';
  stream.everOpened = true;
  stream.timer = setTimeout(() => {
    settle(stream);
  }, LIVE_CLIENT_LIMITS.connectTimeoutMs);
}

function eventOf(frame: MessageEvent<unknown>): LiveEvent | undefined {
  if (typeof frame.data !== 'string') return undefined;
  try {
    const data: unknown = JSON.parse(frame.data);
    return liveEventSchema.safeParse({ id: frame.lastEventId, type: frame.type, data }).data;
  } catch {
    return undefined;
  }
}

function listen(stream: LiveStream, source: EventSource): void {
  source.addEventListener('open', () => {
    markOpen(stream);
  });
  source.addEventListener('error', () => {
    retryLater(stream);
  });
  for (const name of Object.values(LIVE_EVENTS)) {
    source.addEventListener(name, (frame: MessageEvent<unknown>) => {
      settle(stream);
      const event = eventOf(frame);
      if (event !== undefined) {
        stream.handlers.onEvent(event);
      }
    });
  }
}

async function connect(stream: LiveStream): Promise<void> {
  try {
    const { ticket } = await apiClient.request(TICKET_REQUEST);
    if (stream.closed) return;
    const source = new EventSource(`${config.apiBaseUrl}/events/stream?ticket=${ticket}`);
    stream.source = source;
    stream.timer = setTimeout(() => {
      retryLater(stream);
    }, LIVE_CLIENT_LIMITS.connectTimeoutMs);
    listen(stream, source);
  } catch {
    if (stream.closed) return;
    retryLater(stream);
  }
}

export function openLiveStream(handlers: LiveStreamHandlers): () => void {
  const stream: LiveStream = {
    handlers,
    closed: false,
    everOpened: false,
    unsettled: undefined,
    retryMs: LIVE_CLIENT_LIMITS.retryMinMs,
    source: undefined,
    timer: undefined,
  };
  void connect(stream);
  return () => {
    stream.closed = true;
    drop(stream);
  };
}

export function useLiveConnected(): boolean {
  return useSyncExternalStore(subscribe, isConnected, notConnectedOnServer);
}

export function useLivePollMs(): number {
  return useLiveConnected() ? LIVE_CLIENT_LIMITS.slowPollMs : LIVE_LIMITS.pollFallbackMs;
}
