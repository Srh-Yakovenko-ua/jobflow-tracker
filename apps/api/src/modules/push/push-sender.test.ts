import { createECDH, randomBytes } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { generateRequestDetails, generateVAPIDKeys, WebPushError } from 'web-push';

import { DEPENDENCY_LIMITS } from '../../common/probe.js';
import { validateEnv } from '../../config/env.js';
import { exampleEnv } from '../../test/example-env.js';
import { SILENCE_PUSH } from '../../test/push.js';
import { useSilentServers } from '../../test/silent-servers.js';
import { startSilentServer } from '../../test/tcp-proxy.js';
import { pushOptionsOf, pushOutcomeOf, PushSender } from './push-sender.js';

const VAPID = generateVAPIDKeys();

const browserKeys = () => ({
  p256dh: createECDH('prime256v1').generateKeys().toString('base64url'),
  auth: randomBytes(16).toString('base64url'),
});

const startClosedAfterTest = useSilentServers();

async function senderWith(keys: Partial<typeof VAPID> = VAPID) {
  const env = validateEnv({
    ...exampleEnv,
    VAPID_PUBLIC_KEY: keys.publicKey ?? '',
    VAPID_PRIVATE_KEY: keys.privateKey ?? '',
  });
  const moduleRef = await Test.createTestingModule({
    providers: [PushSender, { provide: ConfigService, useValue: new ConfigService(env) }],
  }).compile();
  return moduleRef.get(PushSender);
}

const endpointAt = (port: number) => `https://127.0.0.1:${String(port)}/push/send`;

describe('PushSender', () => {
  it('builds an aes128gcm request with a vapid Authorization and a one-day TTL from generated keys', () => {
    const details = generateRequestDetails(
      { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: browserKeys() },
      JSON.stringify(SILENCE_PUSH),
      pushOptionsOf(VAPID),
    );

    expect(details.headers).toMatchObject({
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: 86_400,
    });
    expect(details.headers.Authorization).toMatch(
      new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${VAPID.publicKey}$`),
    );
  });

  it('is off and has no public key without VAPID keys, on with a whole pair', async () => {
    const off = await senderWith({});
    const on = await senderWith();

    expect([off.enabled, off.publicKey]).toEqual([false, null]);
    expect([on.enabled, on.publicKey]).toEqual([true, VAPID.publicKey]);
  });

  it('answers failed when the push service refuses the connection', async () => {
    const closed = await startSilentServer();
    await closed.close();
    const sender = await senderWith();

    const outcome = await sender.send(
      { endpoint: endpointAt(closed.port), keys: browserKeys() },
      SILENCE_PUSH,
    );

    expect(outcome).toBe('failed');
  });

  it(
    'answers failed within the provider limit when the push service accepts and never answers',
    async () => {
      const silent = await startClosedAfterTest();
      const sender = await senderWith();
      const startedAt = Date.now();

      const outcome = await sender.send(
        { endpoint: endpointAt(silent.port), keys: browserKeys() },
        SILENCE_PUSH,
      );

      expect(outcome).toBe('failed');
      expect(Date.now() - startedAt).toBeLessThan(DEPENDENCY_LIMITS.providerTimeoutMs + 1000);
    },
    DEPENDENCY_LIMITS.providerTimeoutMs * 2,
  );

  const answered = (statusCode: number) =>
    new WebPushError('Received unexpected response code', statusCode, {}, '', 'endpoint');

  it.each([
    { reply: 'a 410 answer', error: answered(410), to: 'gone' },
    { reply: 'a 404 answer', error: answered(404), to: 'gone' },
    { reply: 'a 500 answer', error: answered(500), to: 'failed' },
    { reply: 'a 429 answer', error: answered(429), to: 'failed' },
    { reply: 'a socket timeout', error: new Error('Socket timeout'), to: 'failed' },
  ])('reads $reply as $to', ({ error, to }) => {
    expect(pushOutcomeOf(error)).toBe(to);
  });
});
