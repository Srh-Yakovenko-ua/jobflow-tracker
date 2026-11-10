'use client';

import { LIVE_EVENTS, type LiveEvent, liveEventSchema, liveTicketSchema } from '@jobflow/shared';
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
  retryMs: number;
  source: EventSource | undefined;
  timer: ReturnType<typeof setTimeout> | undefined;
};

const TICKET_REQUEST = {
  path: '/events/ticket',
  method: 'POST',
  schema: liveTicketSchema,
} as const;

type Connection = 'up' | 'down';

const live: { connection: Connection } = { connection: 'down' };

const { subscribe, notify } = createListeners();

function setConnection(connection: Connection): void {
  if (live.connection === connection) return;
  live.connection = connection;
  notify();
}

function isConnected(): boolean {
  return live.connection === 'up';
}

function notConnectedOnServer(): boolean {
  return false;
}

function drop(stream: LiveStream): void {
  clearTimeout(stream.timer);
  stream.source?.close();
  stream.source = undefined;
  setConnection('down');
}

function retryLater(stream: LiveStream): void {
  drop(stream);
  if (stream.closed) return;
  stream.timer = setTimeout(() => {
    void connect(stream);
  }, stream.retryMs);
  stream.retryMs = Math.min(stream.retryMs * 2, LIVE_CLIENT_LIMITS.retryMaxMs);
}

function markOpen(stream: LiveStream): void {
  clearTimeout(stream.timer);
  stream.retryMs = LIVE_CLIENT_LIMITS.retryMinMs;
  setConnection('up');
  if (stream.everOpened) {
    stream.handlers.onReconnect();
  }
  stream.everOpened = true;
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
    retryLater(stream);
  }
}

export function openLiveStream(handlers: LiveStreamHandlers): () => void {
  const stream: LiveStream = {
    handlers,
    closed: false,
    everOpened: false,
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
