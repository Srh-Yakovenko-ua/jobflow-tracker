import { LIVE_LIMITS, type LiveEvent, type LiveTicket } from '@jobflow/shared';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { expect, vi } from 'vitest';

import { apiUrl } from './api-handlers';

export type RawFrame = { type: LiveEvent['type']; id: string; text: string };

export const LIVE_TICKET_URL = apiUrl('/events/ticket');

const LIVE_STREAM_URL = apiUrl('/events/stream');

export class FakeEventSource extends EventTarget {
  readonly url: string;

  closed = false;

  constructor(url: string) {
    super();
    this.url = url;
  }

  close(): void {
    this.closed = true;
  }

  open(): void {
    this.deliver(new Event('open'));
  }

  fail(): void {
    this.deliver(new Event('error'));
  }

  send({ id, type, data }: LiveEvent): void {
    this.sendText({ id, type, text: JSON.stringify(data) });
  }

  sendText({ id, type, text }: RawFrame): void {
    this.deliver(new MessageEvent(type, { data: text, lastEventId: id }));
  }

  private deliver(event: Event): void {
    if (!this.closed) {
      this.dispatchEvent(event);
    }
  }
}

export function stubEventSource() {
  const all: FakeEventSource[] = [];
  class RecordedEventSource extends FakeEventSource {
    constructor(url: string) {
      super(url);
      all.push(this);
    }
  }
  vi.stubGlobal('EventSource', RecordedEventSource);
  return {
    all,
    urls: () => all.map((source) => source.url),
    async source(index: number): Promise<FakeEventSource> {
      await waitFor(() => {
        expect(all.length).toBeGreaterThan(index);
      });
      const source = all[index];
      if (source === undefined) {
        throw new Error(`no stream number ${String(index + 1)} was opened`);
      }
      return source;
    },
  };
}

export function streamUrlFor(ticket: string): string {
  return `${LIVE_STREAM_URL}?ticket=${ticket}`;
}

export function liveTicketRoute() {
  const issued: string[] = [];
  const handler = http.post(LIVE_TICKET_URL, () => {
    const ticket = `ticket-${String(issued.length + 1)}`;
    issued.push(ticket);
    const body: LiveTicket = { ticket, expiresInSeconds: LIVE_LIMITS.ticketTtlSeconds };
    return HttpResponse.json(body);
  });
  return { handler, issued };
}
