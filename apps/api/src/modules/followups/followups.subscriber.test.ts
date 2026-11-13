import { buildFollowupInput } from '@jobflow/shared/testing';
import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { AI_JOB_ID } from '../../test/ai.js';
import { APPLICATION_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { useSubscribedRouter } from '../../test/subscriber.js';
import { FollowupQueueService } from './followup-queue.service.js';
import type { FollowupRequestedPayload } from './followups.events.js';
import { FollowupsSubscriber } from './followups.subscriber.js';

const REQUESTED = {
  userId: OLENA_ID,
  applicationId: APPLICATION_ID,
  aiJobId: AI_JOB_ID,
  input: buildFollowupInput(),
  fresh: true,
};

class RecordingQueue {
  readonly enqueued: FollowupRequestedPayload[] = [];

  enqueue(requested: FollowupRequestedPayload): Promise<void> {
    this.enqueued.push(requested);
    return Promise.resolve();
  }
}

describe('FollowupsSubscriber', () => {
  const queue = new RecordingQueue();
  const { log, route } = useSubscribedRouter([
    FollowupsSubscriber,
    { provide: FollowupQueueService, useValue: queue },
  ]);

  beforeEach(() => {
    queue.enqueued.length = 0;
  });

  it('queues the followup of a requested event', async () => {
    await route('application.followup_requested', REQUESTED);

    expect(queue.enqueued).toEqual([REQUESTED]);
  });

  it('fails an event whose input carries an unknown tone as unrecoverable and queues nothing', async () => {
    const payload = { ...REQUESTED, input: { ...REQUESTED.input, tone: 'angry' } };

    await expect(route('application.followup_requested', payload)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );

    expect(queue.enqueued).toEqual([]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({ level: 50, msg: 'followup event invalid' }),
    ]);
  });
});
