import { act } from '@testing-library/react';
import { vi } from 'vitest';

import { LIVE_CLIENT_LIMITS, openLiveStream } from '@/shared/api';

import { type FakeEventSource, liveTicketRoute, stubEventSource } from './fake-event-source';
import { advanceBy } from './fake-timeouts';
import { server } from './server';

export { LiveUpdates } from '@/app/(app)/live-updates';

type RecordedStream = ReturnType<typeof stubEventSource>;

const opened: (() => void)[] = [];

function openRecordedStream(): void {
  opened.push(openLiveStream({ onEvent: vi.fn(), onReconnect: vi.fn() }));
}

export async function bringLiveStreamUp(start = openRecordedStream): Promise<FakeEventSource> {
  server.use(liveTicketRoute().handler);
  const stream = stubEventSource();
  start();
  const source = await stream.source(0);
  act(() => {
    source.open();
  });
  return source;
}

export async function reopenLiveStream(stream: RecordedStream): Promise<void> {
  const first = await stream.source(0);
  act(() => {
    first.open();
    first.fail();
  });
  await advanceBy(LIVE_CLIENT_LIMITS.retryMinMs);
  const second = await stream.source(1);
  act(() => {
    second.open();
  });
  await advanceBy(LIVE_CLIENT_LIMITS.connectTimeoutMs);
}

export function closeLiveStreams(): void {
  opened.splice(0).forEach((close) => {
    close();
  });
}
