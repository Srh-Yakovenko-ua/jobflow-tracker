import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { describe, expect, it } from 'vitest';

import { QUEUES } from '../../queues/queues.js';
import { memoryLog } from '../../test/memory-log.js';
import { queueDevJob, useAppWithWorker } from '../../test/worker.js';

const log = memoryLog();

function processedLine() {
  return log.parsed().find((line) => line.msg === 'ping processed');
}

describe('a ping job added from the API', () => {
  const stack = useAppWithWorker(log.sink);

  it('is processed by the worker and logged with the same requestId', async () => {
    const response = await queueDevJob(stack.app, {
      path: '/api/v1/dev/jobs/ping',
      requestId: 'it-ping-1',
    });

    expect(response.status).toBe(202);
    const { jobId } = response.body as { jobId: string };
    await expect
      .poll(processedLine, { timeout: 4000 })
      .toMatchObject({ requestId: 'it-ping-1', jobId, queue: 'maintenance', jobName: 'ping' });
  });

  it('schedules every maintenance job once the worker starts, the monthly summary at each UTC hour', async () => {
    const maintenance = stack.worker.get<Queue>(getQueueToken(QUEUES.maintenance.name));

    const schedulers = await maintenance.getJobSchedulers();

    expect(
      schedulers
        .map(({ key, name, every, pattern, tz }) => ({ key, name, every, pattern, tz }))
        .sort((left, right) => left.key.localeCompare(right.key)),
    ).toEqual([
      { key: 'ai-jobs-sweep', name: 'ai-jobs.sweep', every: 900_000 },
      { key: 'auto-ghost-scan', name: 'auto-ghost.scan', every: 3_600_000 },
      { key: 'cleanup', name: 'maintenance.cleanup', every: 86_400_000 },
      { key: 'monthly-summary', name: 'monthly-summary.pick', pattern: '0 * * * *', tz: 'UTC' },
      { key: 'outbox-relay', name: 'outbox.relay', every: 500 },
      { key: 'scheduled-event-reminders', name: 'event-reminders.scan', every: 300_000 },
      { key: 'silence-scan', name: 'silence.scan', every: 900_000 },
    ]);
  });
});
