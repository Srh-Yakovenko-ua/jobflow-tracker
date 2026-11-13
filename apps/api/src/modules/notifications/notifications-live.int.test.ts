import type { INestApplicationContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { DomainEventsProcessor } from '../../outbox/domain-events.processor.js';
import { OutboxRelayService } from '../../outbox/outbox-relay.service.js';
import { useTestApp } from '../../test/app.js';
import { createUser } from '../../test/factories.js';
import { liveEventsOf, openLiveStream, useLiveStreams } from '../../test/live.js';
import { memoryLog } from '../../test/memory-log.js';
import { SILENCE_PAYLOAD } from '../../test/notifications.js';
import { useTestWorkers } from '../../test/worker.js';
import { MAINTENANCE_SCHEDULE_IDS, MAINTENANCE_SCHEDULES } from '../maintenance/index.js';
import { NotificationsService } from './notifications.service.js';

const BELL_LIMIT_MS = 1000;

const RELAY_EVERY_MS =
  MAINTENANCE_SCHEDULES.find(({ id }) => id === MAINTENANCE_SCHEDULE_IDS.outboxRelay)?.repeat
    .every ?? BELL_LIMIT_MS;

const DELIVERY_LIMIT_MS = BELL_LIMIT_MS - RELAY_EVERY_MS;

const log = memoryLog();

describe('a new notification reaching the bell over the live stream', () => {
  const testApp = useTestApp();
  const workers = useTestWorkers(log.sink);
  const streams = useLiveStreams(testApp);

  async function readyWorker(): Promise<INestApplicationContext> {
    const worker = await (await workers.compile()).init();
    await worker.get(DomainEventsProcessor, { strict: false }).worker.waitUntilReady();
    return worker;
  }

  it(`pushes notification.created with the id within ${String(DELIVERY_LIMIT_MS)} ms of one relay tick, so within ${String(BELL_LIMIT_MS)} ms of the write`, async () => {
    const user = await createUser(testApp.prisma);
    const stream = await openLiveStream(testApp.app, user);
    streams.push(stream);
    const worker = await readyWorker();
    await testApp.app
      .get(NotificationsService)
      .record(user.id, { type: 'silence', payload: SILENCE_PAYLOAD });
    const { id: notificationId } = await testApp.prisma.notification.findFirstOrThrow({
      where: { userId: user.id },
      select: { id: true },
    });

    const relayedAt = Date.now();
    await worker.get(OutboxRelayService, { strict: false }).relay();

    await expect.poll(() => liveEventsOf(stream.frames).length, { timeout: 3000 }).toBe(1);
    expect(liveEventsOf(stream.frames).map(({ type, data }) => ({ type, data }))).toEqual([
      { type: 'notification.created', data: { notificationId } },
    ]);
    const [frame] = stream.frames.filter(({ event }) => event !== undefined);
    expect((frame?.receivedAt ?? Infinity) - relayedAt).toBeLessThan(DELIVERY_LIMIT_MS);
  });
});
