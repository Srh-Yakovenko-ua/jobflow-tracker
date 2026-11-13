import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplicationContext } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { describe, expect, it } from 'vitest';

import { QUEUES } from '../../queues/queues.js';
import { callRoute, errorPathsOf } from '../../test/http.js';
import { memoryLog } from '../../test/memory-log.js';
import { queueDevJob, useAppWithWorker } from '../../test/worker.js';
import { jobAcceptedSchema } from './maintenance.jobs.js';

const log = memoryLog();

const SCHEDULER_IDS = [
  'ai-jobs-sweep',
  'auto-ghost-scan',
  'cleanup',
  'monthly-summary',
  'outbox-relay',
  'scheduled-event-reminders',
  'silence-scan',
];

const ONE_DELAYED_JOB_EACH = {
  'ai-jobs-sweep': 1,
  'auto-ghost-scan': 1,
  cleanup: 1,
  'monthly-summary': 1,
  'scheduled-event-reminders': 1,
  'silence-scan': 1,
};

const SCHEDULE_SETTLE_MS = 8000;

const maintenanceQueue = (worker: INestApplicationContext) =>
  worker.get<Queue>(getQueueToken(QUEUES.maintenance.name));

async function schedulerIds(worker: INestApplicationContext): Promise<string[]> {
  const schedulers = await maintenanceQueue(worker).getJobSchedulers();
  return schedulers.map(({ key }) => key).sort();
}

async function delayedJobsPerScheduler(
  worker: INestApplicationContext,
): Promise<Record<string, number>> {
  const delayed = await maintenanceQueue(worker).getDelayed();
  const counts: Record<string, number> = {};
  for (const { repeatJobKey } of delayed) {
    if (repeatJobKey !== undefined && repeatJobKey !== 'outbox-relay') {
      counts[repeatJobKey] = (counts[repeatJobKey] ?? 0) + 1;
    }
  }
  return counts;
}

const scheduledRunOf = (jobId: string) =>
  log.parsed().find((line) => line.msg === 'scheduled job ran' && line.jobId === jobId);

describe('the maintenance schedules in the worker', () => {
  const stack = useAppWithWorker(log.sink);

  it(
    'keeps each scheduler once with one delayed job after the worker restarts',
    { timeout: 3 * SCHEDULE_SETTLE_MS },
    async () => {
      await expect
        .poll(() => delayedJobsPerScheduler(stack.worker), { timeout: SCHEDULE_SETTLE_MS })
        .toEqual(ONE_DELAYED_JOB_EACH);

      const restarted = await stack.restartWorker();

      expect(await schedulerIds(restarted)).toEqual(SCHEDULER_IDS);
      await expect
        .poll(() => delayedJobsPerScheduler(restarted), { timeout: SCHEDULE_SETTLE_MS })
        .toEqual(ONE_DELAYED_JOB_EACH);
    },
  );

  it('runs a silence scan at once when the dev trigger asks, logged with the requestId', async () => {
    const response = await queueDevJob(stack.app, {
      path: '/api/v1/dev/jobs/silence-scan',
      requestId: 'it-run-1',
    });

    expect(response.status).toBe(202);
    const { jobId } = jobAcceptedSchema.parse(response.body);
    await expect
      .poll(() => scheduledRunOf(jobId), { timeout: 4000 })
      .toMatchObject({
        requestId: 'it-run-1',
        queue: 'maintenance',
        jobName: 'silence.scan',
      });
  });

  it('refuses the dev trigger without an access token with 401', async () => {
    const response = await callRoute(stack.app, {
      method: 'post',
      path: '/api/v1/dev/jobs/silence-scan',
    });

    expect(response.status).toBe(401);
  });

  it('answers 422 on the schedule path for a scheduler that does not exist', async () => {
    const response = await queueDevJob(stack.app, {
      path: '/api/v1/dev/jobs/unknown-scan',
      requestId: 'it-run-2',
    });

    expect(response.status).toBe(422);
    expect(errorPathsOf(response.body)).toEqual(['schedule']);
  });
});
