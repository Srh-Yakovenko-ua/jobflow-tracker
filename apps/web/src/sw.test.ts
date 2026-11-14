import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

import type { PushMessage } from '@jobflow/shared';
import { describe, expect, it, vi } from 'vitest';

const WORKER_SOURCE = readFileSync(join(import.meta.dirname, '..', 'public', 'sw.js'), 'utf8');

const ORIGIN = 'http://localhost:3000';

const SILENCE_PUSH: PushMessage = {
  title: 'Тиша 14 днів: Acme',
  body: 'Час написати фоллоу-ап.',
  url: '/applications/0b6f3c1e-7d2a-4f5b-9c8e-1a2b3c4d5e6f',
  tag: 'silence-0b6f3c1e',
};

type Listener = (event: FakeEvent) => void;

type FakeEvent = {
  data?: { json: () => unknown } | null;
  notification?: { data: unknown; close: () => void };
  waitUntil: (promise: Promise<unknown>) => void;
};

type FakeWindow = { url: string; focus: () => Promise<unknown> };

function startWorker(windows: readonly FakeWindow[] = []) {
  const listeners = new Map<string, Listener>();
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, listener);
    },
    skipWaiting: vi.fn(() => Promise.resolve()),
    registration: { showNotification: vi.fn(() => Promise.resolve()) },
    clients: {
      claim: vi.fn(() => Promise.resolve()),
      matchAll: vi.fn(() => Promise.resolve(windows)),
      openWindow: vi.fn(() => Promise.resolve(null)),
    },
  };
  runInNewContext(WORKER_SOURCE, { self, URL });
  const dispatch = async (type: string, event: Omit<FakeEvent, 'waitUntil'>) => {
    const pending: Promise<unknown>[] = [];
    listeners.get(type)?.({ ...event, waitUntil: (promise) => pending.push(promise) });
    await Promise.all(pending);
  };
  return { self, dispatch };
}

function clickOn(url: unknown) {
  return { notification: { data: { url }, close: vi.fn() } };
}

function windowAt(path: string): FakeWindow {
  return { url: `${ORIGIN}${path}`, focus: vi.fn(() => Promise.resolve()) };
}

describe('sw.js', () => {
  it('takes over at once: install skips waiting and activate claims open tabs', async () => {
    const { self, dispatch } = startWorker();

    await dispatch('install', {});
    await dispatch('activate', {});

    expect(self.skipWaiting).toHaveBeenCalledTimes(1);
    expect(self.clients.claim).toHaveBeenCalledTimes(1);
  });

  it('a silence push shows its title, body and tag with the JobFlow icon and keeps the card url', async () => {
    const { self, dispatch } = startWorker();

    await dispatch('push', { data: { json: () => SILENCE_PUSH } });

    expect(self.registration.showNotification).toHaveBeenCalledWith('Тиша 14 днів: Acme', {
      body: 'Час написати фоллоу-ап.',
      tag: 'silence-0b6f3c1e',
      icon: '/icons/jobflow-192.png',
      data: { url: '/applications/0b6f3c1e-7d2a-4f5b-9c8e-1a2b3c4d5e6f' },
    });
  });

  it.each([
    {
      name: 'an unparsable payload',
      data: {
        json: () => {
          throw new SyntaxError('Unexpected token');
        },
      },
    },
    { name: 'a payload without a title', data: { json: () => ({ ...SILENCE_PUSH, title: 7 }) } },
    { name: 'no payload at all', data: null },
  ])(
    '$name still shows the JobFlow notification leading to the notification centre',
    async ({ data }) => {
      const { self, dispatch } = startWorker();

      await dispatch('push', { data });

      expect(self.registration.showNotification).toHaveBeenCalledWith('JobFlow', {
        body: '',
        tag: 'jobflow',
        icon: '/icons/jobflow-192.png',
        data: { url: '/notifications' },
      });
    },
  );

  it('a click focuses the tab already showing the card and opens no new one', async () => {
    const board = windowAt('/board');
    const card = windowAt(SILENCE_PUSH.url);
    const { self, dispatch } = startWorker([board, card]);
    const click = clickOn(SILENCE_PUSH.url);

    await dispatch('notificationclick', click);

    expect(click.notification.close).toHaveBeenCalledTimes(1);
    expect(self.clients.matchAll).toHaveBeenCalledWith({
      type: 'window',
      includeUncontrolled: true,
    });
    expect(card.focus).toHaveBeenCalledTimes(1);
    expect(board.focus).not.toHaveBeenCalled();
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it('a click with no tab on the card opens the card url', async () => {
    const board = windowAt('/board');
    const { self, dispatch } = startWorker([board]);

    await dispatch('notificationclick', clickOn(SILENCE_PUSH.url));

    expect(board.focus).not.toHaveBeenCalled();
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}${SILENCE_PUSH.url}`);
  });

  it.each(['https://evil.example/phish', '//evil.example/phish', undefined])(
    'a click on %s opens the notification centre on this site instead',
    async (url) => {
      const { self, dispatch } = startWorker();

      await dispatch('notificationclick', clickOn(url));

      expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/notifications`);
    },
  );
});
