import { CAPTURE_BOOKMARKLET_LIMITS, type CaptureBookmarkletInput } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { idempotencyKeyOf, payloadOf, sendCapture } from './capture.js';
import {
  ADDED_BODY,
  CONFIG,
  conflictReply,
  DUPLICATE,
  type FetchReply,
  stubFetch,
} from './test/api.js';
import { DJINNI_PAGE } from './test/fixtures/pages.js';
import { elementOf, mountPage } from './test/page.js';

const DATE = new Date('2026-11-10T12:00:00.000Z');

const PAYLOAD: CaptureBookmarkletInput = {
  url: 'https://djinni.co/jobs/718293-middle-python-engineer/',
  title: 'Middle Python Engineer at Initech | Djinni',
  text: 'Middle Python Engineer\nDjango, PostgreSQL, Celery.',
};

function mountText(text: string, title = ''): void {
  mountPage({ html: '<main></main>', title });
  elementOf('main').textContent = text;
}

function bodyBytesOf(payload: CaptureBookmarkletInput): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}

function send() {
  return sendCapture({ config: CONFIG, payload: PAYLOAD, date: DATE });
}

describe('payloadOf', () => {
  it('sends the page address, the trimmed title and the vacancy text, never html', () => {
    mountPage({ ...DJINNI_PAGE, title: `  ${DJINNI_PAGE.title}\n` });

    expect(payloadOf(document)).toEqual({
      url: 'http://localhost:3000/jobs/718293-middle-python-engineer/',
      title: 'Middle Python Engineer at Initech | Djinni',
      text: 'Middle Python Engineer\nБудуємо платформу аналітики для рітейлу.\nDjango, PostgreSQL, Celery.\nТільки віддалено\n3 роки досвіду',
    });
  });

  it('names the page by its host when the title is blank', () => {
    mountText('Опис вакансії', '   ');

    expect(payloadOf(document).title).toBe('localhost');
  });

  it('cuts the title to 300 characters', () => {
    mountText('Опис вакансії', 'я'.repeat(400));

    expect(payloadOf(document).title).toBe('я'.repeat(300));
  });

  it('removes NUL characters the API refuses', () => {
    mountText('React\u0000 developer', 'Acme\u0000 Software');

    expect(payloadOf(document)).toMatchObject({ title: 'Acme Software', text: 'React developer' });
  });

  it.each([
    ['a Cyrillic page', 'я'],
    ['a page whose every character escapes to six bytes', '\u0001'],
  ])('keeps the body of %s of 300 000 characters under the byte limit', (_name, character) => {
    mountText(character.repeat(300_000));
    const payload = payloadOf(document);

    expect(payload.text).toBe(character.repeat(20_000));
    expect(bodyBytesOf(payload)).toBeLessThan(CAPTURE_BOOKMARKLET_LIMITS.bodyMaxBytes);
  });
});

describe('idempotencyKeyOf', () => {
  it('joins the UTC date and the FNV-1a hash of the url', () => {
    expect(idempotencyKeyOf({ url: 'foobar', date: DATE })).toBe('bm-2026-11-10-bf9cf968');
  });

  it('pads a short hash to eight hex digits', () => {
    const url = 'https://djinni.co/jobs/15-python-engineer/';

    expect(idempotencyKeyOf({ url, date: DATE })).toBe('bm-2026-11-10-0d2333d8');
  });

  it('stays the same for one url through one UTC day', () => {
    const morning = idempotencyKeyOf({ url: PAYLOAD.url, date: new Date('2026-11-10T00:00:00Z') });
    const night = idempotencyKeyOf({ url: PAYLOAD.url, date: new Date('2026-11-10T23:59:59Z') });

    expect(night).toBe(morning);
  });

  it('changes with the url and with the UTC date', () => {
    const key = idempotencyKeyOf({ url: PAYLOAD.url, date: DATE });

    expect(idempotencyKeyOf({ url: `${PAYLOAD.url}?utm_source=walk`, date: DATE })).not.toBe(key);
    expect(idempotencyKeyOf({ url: PAYLOAD.url, date: new Date('2026-11-11T00:00:00Z') })).not.toBe(
      key,
    );
  });
});

describe('sendCapture', () => {
  it('posts the payload with the capture token and the idempotency key, without cookies', async () => {
    const fetchStub = stubFetch({ status: 202, body: ADDED_BODY });

    await send();

    expect(fetchStub).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/capture/bookmarklet',
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        body: JSON.stringify(PAYLOAD),
        headers: {
          Authorization: `Capture ${CONFIG.token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKeyOf({ url: PAYLOAD.url, date: DATE }),
        },
      }),
    );
  });

  it.each<{ name: string; reply: FetchReply; outcome: object }>([
    {
      name: 'an accepted capture',
      reply: { status: 202, body: ADDED_BODY },
      outcome: { kind: 'added', applicationId: '6f1c2b1e-5a0d-4c5e-9b7a-2f4d8e1a3c10' },
    },
    {
      name: 'an accepted capture with a possible duplicate',
      reply: { status: 202, body: { ...ADDED_BODY, possibleDuplicates: [DUPLICATE] } },
      outcome: {
        kind: 'added',
        applicationId: '6f1c2b1e-5a0d-4c5e-9b7a-2f4d8e1a3c10',
        duplicate: DUPLICATE,
      },
    },
    { name: 'a revoked token', reply: { status: 401 }, outcome: { kind: 'unauthorized' } },
    { name: 'a conflict without a type', reply: { status: 409 }, outcome: { kind: 'conflict' } },
    { name: 'no active search', reply: conflictReply('conflict'), outcome: { kind: 'conflict' } },
    {
      name: 'the same page sent again today',
      reply: conflictReply('idempotency_conflict'),
      outcome: { kind: 'repeated' },
    },
    {
      name: 'a rate limit with an endless Retry-After',
      reply: { status: 429, headers: { 'Retry-After': 'Infinity' } },
      outcome: { kind: 'rateLimited', retryAfterSeconds: 60 },
    },
    {
      name: 'a rate limit with a negative Retry-After',
      reply: { status: 429, headers: { 'Retry-After': '-5' } },
      outcome: { kind: 'rateLimited', retryAfterSeconds: 60 },
    },
    {
      name: 'a rate limit with Retry-After',
      reply: { status: 429, headers: { 'Retry-After': '90' } },
      outcome: { kind: 'rateLimited', retryAfterSeconds: 90 },
    },
    {
      name: 'a rate limit without Retry-After',
      reply: { status: 429 },
      outcome: { kind: 'rateLimited', retryAfterSeconds: 60 },
    },
    { name: 'a body over the limit', reply: { status: 413 }, outcome: { kind: 'failed' } },
    { name: 'a refused body', reply: { status: 422 }, outcome: { kind: 'failed' } },
    { name: 'a server error', reply: { status: 500 }, outcome: { kind: 'failed' } },
    {
      name: 'an accepted reply without an application id',
      reply: { status: 202, body: {} },
      outcome: { kind: 'failed' },
    },
    {
      name: 'a duplicate in a stage the script does not know',
      reply: {
        status: 202,
        body: { ...ADDED_BODY, possibleDuplicates: [{ ...DUPLICATE, stage: 'hired' }] },
      },
      outcome: { kind: 'failed' },
    },
  ])('maps $name to its outcome', async ({ reply, outcome }) => {
    stubFetch(reply);

    await expect(send()).resolves.toEqual(outcome);
  });

  it('reports an API the page may not reach as unreachable', async () => {
    stubFetch(new TypeError('Failed to fetch'));

    await expect(send()).resolves.toEqual({ kind: 'unreachable' });
  });
});
