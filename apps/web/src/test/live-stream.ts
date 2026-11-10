import { act } from '@testing-library/react';
import { vi } from 'vitest';

import { openLiveStream } from '@/shared/api';

import { liveTicketRoute, stubEventSource } from './fake-event-source';
import { server } from './server';

const opened: (() => void)[] = [];

export async function bringLiveStreamUp(): Promise<void> {
  server.use(liveTicketRoute().handler);
  const stream = stubEventSource();
  opened.push(openLiveStream({ onEvent: vi.fn(), onReconnect: vi.fn() }));
  const source = await stream.source(0);
  act(() => {
    source.open();
  });
}

export function closeLiveStreams(): void {
  opened.splice(0).forEach((close) => {
    close();
  });
}
