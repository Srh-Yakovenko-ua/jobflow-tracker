import { describe, expect, it } from 'vitest';

import { scrubErrorEvent } from './error-event-scrub.js';

const EMAIL = 'ivan.petrenko@example.com';

const NOTE = 'Нотатка: рекрутер обіцяв офер до пʼятниці';

const LEAK = `${EMAIL} ${NOTE}`;

const FRAMES = [
  { filename: 'src/app/dev/ui/error-states-section.tsx', function: 'FragileWidget', lineno: 42 },
];

const EVENT = {
  event_id: '5f3a9c0e1b2d4e6f8a7b6c5d4e3f2a1b',
  message: LEAK,
  logentry: { message: LEAK, params: [EMAIL] },
  exception: {
    values: [{ type: 'Error', value: LEAK, stacktrace: { frames: FRAMES } }],
  },
  request: {
    url: `http://localhost:3000/applications/1?email=${EMAIL}#${NOTE}`,
    method: 'POST',
    data: { email: EMAIL, note: NOTE },
    query_string: `email=${EMAIL}`,
    cookies: { session: EMAIL },
    headers: { 'x-note': NOTE },
    env: { REMOTE_ADDR: '192.168.1.7' },
  },
  user: { email: EMAIL, ip_address: '192.168.1.7' },
  extra: { note: NOTE },
  breadcrumbs: [{ category: 'console', message: LEAK }],
  tags: { code: '5f3a9c0e', digest: '2481632' },
};

describe('scrubErrorEvent', () => {
  const scrubbed = scrubErrorEvent(EVENT);
  const serialized = JSON.stringify(scrubbed);

  it.each([
    { name: 'the email', text: EMAIL },
    { name: 'the note text', text: NOTE },
    { name: 'the client address', text: '192.168.1.7' },
  ])('sends no trace of $name anywhere in the event', ({ text }) => {
    expect(serialized).not.toContain(text);
  });

  it('keeps the error type and its stack frames', () => {
    expect(scrubbed.exception.values).toEqual([{ type: 'Error', stacktrace: { frames: FRAMES } }]);
  });

  it('keeps the event id and the tags that find the event', () => {
    expect(scrubbed.event_id).toBe('5f3a9c0e1b2d4e6f8a7b6c5d4e3f2a1b');
    expect(scrubbed.tags).toEqual({ code: '5f3a9c0e', digest: '2481632' });
  });

  it('keeps the route and the method of the request, without its query', () => {
    expect(scrubbed.request).toEqual({
      url: 'http://localhost:3000/applications/1',
      method: 'POST',
    });
  });

  it('leaves the event it was given untouched', () => {
    expect(EVENT.message).toBe(LEAK);
    expect(EVENT.exception.values[0]?.value).toBe(LEAK);
  });

  it('groups the event by its type and the top in-app frame, so distinct throw sites get distinct issues', () => {
    expect(scrubbed.fingerprint).toEqual([
      'Error',
      'src/app/dev/ui/error-states-section.tsx',
      'FragileWidget',
    ]);
  });

  it('takes the fingerprint from the thrown exception and its last in-app frame, past library frames and query', () => {
    const chained = scrubErrorEvent({
      exception: {
        values: [
          { type: 'TypeError', stacktrace: { frames: FRAMES } },
          {
            type: 'RangeError',
            value: LEAK,
            stacktrace: {
              frames: [
                { filename: 'http://localhost:3000/board?email=x', function: 'BoardPage' },
                {
                  filename: 'node_modules/react-dom/client.js',
                  function: 'renderRoot',
                  in_app: false,
                },
              ],
            },
          },
        ],
      },
    });

    expect(chained.fingerprint).toEqual(['RangeError', 'http://localhost:3000/board', 'BoardPage']);
  });

  it('passes an event without a request or an exception through', () => {
    expect(scrubErrorEvent({ message: LEAK, tags: { code: '5f3a9c0e' } })).toEqual({
      tags: { code: '5f3a9c0e' },
    });
  });
});
