import { once } from 'node:events';
import { createServer } from 'node:http';

import { Logger } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { UnrecoverableError } from 'bullmq';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DEPENDENCY_LIMITS } from '../../common/probe.js';
import { memoryLog } from '../../test/memory-log.js';
import { processedJob } from '../../test/processed-job.js';
import { compileProcessorModule } from '../../test/processor.js';
import { useSilentServers } from '../../test/silent-servers.js';
import { closedPortUrl, listenLocally, outcomeWithin } from '../../test/tcp-proxy.js';
import { pushUptime } from './uptime-push.js';

const PUSH_TOKEN = 'f6c2a9e04b7d4e1a8c3f5b902d6e7a14';

const PUSH_PATH = `/api/push/${PUSH_TOKEN}`;

const log = memoryLog();

const logger = new Logger('UptimePushUnderTest');

const startSilent = useSilentServers();

const closers: (() => Promise<void>)[] = [];

async function kumaAnswering(status: number) {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(`${request.method ?? ''} ${request.url ?? ''}`);
    response.writeHead(status).end('{"ok":true}');
  });
  const port = await listenLocally(server);
  closers.push(async () => {
    server.closeAllConnections();
    await once(server.close(), 'close');
  });
  return { origin: `http://127.0.0.1:${String(port)}`, requests };
}

const pushTo = (url: string) =>
  pushUptime({
    job: processedJob({ queueName: 'maintenance', name: 'uptime.push', data: { url } }),
    logger,
  });

const warnings = () => log.parsed().filter((line) => line.level === 40);

describe('pushUptime', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await compileProcessorModule(log.sink, []);
  });

  beforeEach(() => {
    log.lines.length = 0;
  });

  afterEach(async () => {
    await Promise.all(closers.splice(0).map((close) => close()));
  });

  afterAll(() => moduleRef.close());

  it('sends exactly one GET to the push URL and logs no warning when Kuma answers', async () => {
    const kuma = await kumaAnswering(200);

    await pushTo(`${kuma.origin}${PUSH_PATH}`);

    expect(kuma.requests).toEqual([`GET ${PUSH_PATH}`]);
    expect(warnings()).toEqual([]);
  });

  it('resolves with one warning and no push token in the log when Kuma refuses the connection', async () => {
    const closed = await closedPortUrl();

    await expect(pushTo(`${closed}${PUSH_PATH}`)).resolves.toBeUndefined();

    expect(warnings()).toEqual([
      expect.objectContaining({ msg: 'uptime push failed', jobName: 'uptime.push' }),
    ]);
    expect(log.lines.join('\n')).not.toContain(PUSH_TOKEN);
  });

  it(
    'resolves within the push limit with one warning when Kuma accepts and never answers',
    async () => {
      const silent = await startSilent();

      const outcome = await outcomeWithin(
        pushTo(`${silent.url}${PUSH_PATH}`),
        DEPENDENCY_LIMITS.uptimePushTimeoutMs + 1000,
      );

      expect(outcome).toBe('answered');
      expect(warnings()).toEqual([expect.objectContaining({ msg: 'uptime push failed' })]);
    },
    DEPENDENCY_LIMITS.uptimePushTimeoutMs * 3,
  );

  it('logs one warning with the status when Kuma answers 404', async () => {
    const kuma = await kumaAnswering(404);

    await pushTo(`${kuma.origin}${PUSH_PATH}`);

    expect(warnings()).toEqual([
      expect.objectContaining({ msg: 'uptime push failed', status: 404 }),
    ]);
    expect(log.lines.join('\n')).not.toContain(PUSH_TOKEN);
  });

  it('fails a job without an http push URL as unrecoverable', async () => {
    await expect(pushTo('ftp://uptime-kuma/api/push/x')).rejects.toBeInstanceOf(UnrecoverableError);
    expect(log.parsed()).toEqual([
      expect.objectContaining({ level: 50, msg: 'uptime push payload invalid' }),
    ]);
  });
});
