import { analyticsVersionKey } from '@jobflow/shared';
import type { INestApplicationContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { OutboxRelayService } from '../../outbox/outbox-relay.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { useTestApp } from '../../test/app.js';
import {
  createApplication,
  postStageMove,
  ROMASHKA,
  signedInWithSearch,
} from '../../test/applications.js';
import { memoryLog } from '../../test/memory-log.js';
import { TO_SCREENING } from '../../test/service-fixtures.js';
import { useTestWorkers } from '../../test/worker.js';

const WORKER_TEST = { timeout: 45_000 };

const SETTLED = { timeout: 20_000 };

const log = memoryLog();

describe('analytics cache invalidation by the worker', () => {
  const testApp = useTestApp();
  const workers = useTestWorkers(log.sink);

  function versionReader(worker: INestApplicationContext) {
    const redis = worker.get(RedisService, { strict: false }).client;
    const relay = worker.get(OutboxRelayService, { strict: false });
    const versionOf = async (userId: string) =>
      Number((await redis.get(analyticsVersionKey(userId))) ?? 0);
    const relayedVersionOf = async (userId: string) => {
      await relay.relay();
      return versionOf(userId);
    };
    return { versionOf, relayedVersionOf };
  }

  it(
    "raises the mover's analytics version by one for a stage move posted over HTTP and leaves another user's alone",
    WORKER_TEST,
    async () => {
      const { versionOf, relayedVersionOf } = versionReader(await (await workers.compile()).init());
      const owner = await signedInWithSearch(testApp.prisma);
      const other = await signedInWithSearch(testApp.prisma);
      const { accessToken } = owner;
      const { id } = await createApplication(testApp.app, { accessToken, input: ROMASHKA });
      await expect.poll(() => relayedVersionOf(owner.userId), SETTLED).toBe(1);

      const moved = await postStageMove(testApp.app, { accessToken, id, input: TO_SCREENING });

      expect(moved.status).toBe(201);
      await expect.poll(() => relayedVersionOf(owner.userId), SETTLED).toBe(2);
      expect(await versionOf(other.userId)).toBe(0);
    },
  );
});
