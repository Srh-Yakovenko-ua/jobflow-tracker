import { UnrecoverableError } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { OutboxRelayService } from '../../outbox/outbox-relay.service.js';
import { AiJobsSweepService } from '../../scheduled-jobs/ai-jobs-sweep.service.js';
import { AutoGhostScanService } from '../../scheduled-jobs/auto-ghost-scan.service.js';
import { ScheduledJobsService } from '../../scheduled-jobs/scheduled-jobs.service.js';
import { memoryLog } from '../../test/memory-log.js';
import { processedJob } from '../../test/processed-job.js';
import { compileProcessorModule } from '../../test/processor.js';
import { RhythmRequestsService } from '../rhythm/index.js';
import { SummaryRequestsService } from '../summaries/index.js';
import { LocalHourRequestsService } from './local-hour-requests.service.js';
import { MaintenanceProcessor } from './maintenance.processor.js';
import { ScheduledSweepsService } from './scheduled-sweeps.service.js';

const log = memoryLog();

class FakeOutboxRelay {
  readonly calls: string[] = [];

  relay(): Promise<number> {
    this.calls.push('relay');
    return Promise.resolve(3);
  }

  deletePublished(): Promise<number> {
    this.calls.push('deletePublished');
    return Promise.resolve(1);
  }
}

class FakeScheduledJobs {
  readonly calls: string[] = [];

  cleanup(): Promise<void> {
    return this.called('cleanup');
  }

  async monthlySummaryUsers(): Promise<string[]> {
    await this.called('monthlySummaryUsers');
    return PICKED_USER_IDS;
  }

  async weekCloseUsers(): Promise<string[]> {
    await this.called('weekCloseUsers');
    return PICKED_USER_IDS;
  }

  silenceScan(): Promise<void> {
    return this.called('silenceScan');
  }

  interviewReminders(): Promise<void> {
    return this.called('interviewReminders');
  }

  private called(method: string): Promise<void> {
    this.calls.push(method);
    return Promise.resolve();
  }
}

const PICKED_USER_IDS = ['user-kyiv', 'user-kolkata'];

class RecordingAutoGhostScan {
  scans = 0;

  scan() {
    this.scans += 1;
    return Promise.resolve({ users: 0, moved: 0, skipped: 0 });
  }
}

class RecordingAiJobsSweep {
  readonly calls: string[] = [];

  sweepStaleAiJobs(): Promise<number> {
    this.calls.push('sweepStaleAiJobs');
    return Promise.resolve(1);
  }

  redeliverUnsettledAiFailures(): Promise<number> {
    this.calls.push('redeliverUnsettledAiFailures');
    return Promise.resolve(1);
  }
}

class RecordingLocalHourRequests {
  readonly requested: [string, string[]][] = [];

  requestScheduledFor(userIds: string[]) {
    return this.record('monthlySummary', userIds);
  }

  requestWeekClose(userIds: string[]) {
    return this.record('weekClose', userIds);
  }

  private record(kind: string, userIds: string[]) {
    this.requested.push([kind, userIds]);
    return Promise.resolve({ picked: userIds.length, requested: userIds.length });
  }
}

function pingJob(data: unknown) {
  return processedJob({ queueName: 'maintenance', name: 'ping', data, id: '42' });
}

function tickJob(name: string) {
  return processedJob({ queueName: 'maintenance', name, data: undefined });
}

describe('MaintenanceProcessor', () => {
  const outbox = new FakeOutboxRelay();
  const scheduledJobs = new FakeScheduledJobs();
  const requests = new RecordingLocalHourRequests();
  const autoGhost = new RecordingAutoGhostScan();
  const aiJobs = new RecordingAiJobsSweep();
  let processor: MaintenanceProcessor;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await compileProcessorModule(log.sink, [
      MaintenanceProcessor,
      LocalHourRequestsService,
      ScheduledSweepsService,
      { provide: OutboxRelayService, useValue: outbox },
      { provide: ScheduledJobsService, useValue: scheduledJobs },
      { provide: SummaryRequestsService, useValue: requests },
      { provide: AutoGhostScanService, useValue: autoGhost },
      { provide: AiJobsSweepService, useValue: aiJobs },
      { provide: RhythmRequestsService, useValue: requests },
    ]);
    processor = moduleRef.get(MaintenanceProcessor);
    close = () => moduleRef.close();
  });

  beforeEach(() => {
    log.lines.length = 0;
    outbox.calls.length = 0;
    scheduledJobs.calls.length = 0;
    requests.requested.length = 0;
    autoGhost.scans = 0;
    aiJobs.calls.length = 0;
  });

  afterAll(async () => {
    await close();
  });

  it('fails a ping without a requestId as unrecoverable, so it is not retried', async () => {
    await expect(processor.process(pingJob({ holdMs: 0 }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(log.parsed()).toEqual([
      expect.objectContaining({ level: 50, msg: 'ping payload invalid', jobId: '42' }),
    ]);
  });

  it('logs ping started and ping processed with the requestId, jobId, queue and job name', async () => {
    await processor.process(pingJob({ requestId: 'req-7', holdMs: 0 }));

    const fields = { requestId: 'req-7', jobId: '42', queue: 'maintenance', jobName: 'ping' };
    expect(log.parsed()).toEqual([
      expect.objectContaining({ ...fields, msg: 'ping started' }),
      expect.objectContaining({ ...fields, msg: 'ping processed' }),
    ]);
  });

  it('logs a failed job with its requestId and attemptsMade', () => {
    processor.onFailed(
      { ...pingJob({ requestId: 'req-8', holdMs: 0 }), attemptsMade: 2 },
      new Error('boom'),
    );

    expect(log.parsed()).toMatchObject([
      {
        level: 40,
        msg: 'job failed',
        requestId: 'req-8',
        attemptsMade: 2,
        err: { type: 'Error' },
      },
    ]);
  });

  it('runs one outbox relay pass for an outbox.relay job', async () => {
    await processor.process(tickJob('outbox.relay'));

    expect(outbox.calls).toEqual(['relay']);
  });

  it('deletes published outbox rows for a maintenance.cleanup job', async () => {
    await processor.process(tickJob('maintenance.cleanup'));

    expect(outbox.calls).toEqual(['deletePublished']);
  });

  it('also deletes expired idempotency keys, refresh tokens and notifications for a maintenance.cleanup job', async () => {
    await processor.process(tickJob('maintenance.cleanup'));

    expect(scheduledJobs.calls).toEqual(['cleanup']);
  });

  it.each([
    ['monthly-summary.pick', 'monthlySummaryUsers'],
    ['rhythm.week-close.pick', 'weekCloseUsers'],
    ['silence.scan', 'silenceScan'],
    ['event-reminders.scan', 'interviewReminders'],
  ])('runs the scheduled jobs step for a %s job', async (name, method) => {
    await processor.process(tickJob(name));

    expect(scheduledJobs.calls).toEqual([method]);
    expect(outbox.calls).toEqual([]);
  });

  it('fails the stale ai jobs and then redelivers the unsettled ai failures for an ai-jobs.sweep job', async () => {
    await processor.process(tickJob('ai-jobs.sweep'));

    expect(aiJobs.calls).toEqual(['sweepStaleAiJobs', 'redeliverUnsettledAiFailures']);
    expect(scheduledJobs.calls).toEqual([]);
    expect(outbox.calls).toEqual([]);
  });

  it('requests the monthly summaries of the users picked for a monthly-summary.pick job', async () => {
    await processor.process(tickJob('monthly-summary.pick'));

    expect(requests.requested).toEqual([['monthlySummary', ['user-kyiv', 'user-kolkata']]]);
  });

  it('requests the week close of the users picked for a rhythm.week-close.pick job', async () => {
    await processor.process(tickJob('rhythm.week-close.pick'));

    expect(requests.requested).toEqual([['weekClose', ['user-kyiv', 'user-kolkata']]]);
  });

  it('runs the auto ghost scan for an auto-ghost.scan job', async () => {
    await processor.process(tickJob('auto-ghost.scan'));

    expect(autoGhost.scans).toBe(1);
    expect(scheduledJobs.calls).toEqual([]);
  });

  it.each(['auto-ghost.scan', 'silence.scan', 'event-reminders.scan'])(
    'logs a %s run with its requestId, jobId, queue and job name',
    async (name) => {
      await processor.process(
        processedJob({ queueName: 'maintenance', name, data: { requestId: 'req-9' }, id: '51' }),
      );

      expect(log.parsed()).toEqual([
        expect.objectContaining({
          msg: 'scheduled job ran',
          requestId: 'req-9',
          jobId: '51',
          queue: 'maintenance',
          jobName: name,
        }),
      ]);
    },
  );

  it('hands an uptime.push job to the uptime push, which refuses a payload without a URL', async () => {
    await expect(processor.process(tickJob('uptime.push'))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(log.parsed()).toEqual([
      expect.objectContaining({ level: 50, msg: 'uptime push payload invalid' }),
    ]);
  });

  it('fails a job with an unknown name as unrecoverable and runs nothing', async () => {
    await expect(processor.process(tickJob('outbox.replay'))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(outbox.calls).toEqual([]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({
        level: 50,
        msg: 'maintenance job unknown',
        jobName: 'outbox.replay',
      }),
    ]);
  });
});
