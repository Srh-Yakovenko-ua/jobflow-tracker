import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { AI_JOB_ID } from '../../test/ai.js';
import { INTERVIEW_PREP_VACANCY } from '../../test/interview-prep.js';
import {
  APPLICATION_ID,
  FINAL_DELIVERY,
  FIRST_DELIVERY,
  OLENA_ID,
} from '../../test/service-fixtures.js';
import { RecordingEventQueue, useSubscribedRouter } from '../../test/subscriber.js';
import {
  INTERVIEW_PREP_EVENTS,
  type InterviewPrepRequestedPayload,
} from './interview-prep.events.js';
import { InterviewPrepSubscriber } from './interview-prep.subscriber.js';
import { InterviewPrepQueueService } from './interview-prep-queue.service.js';

const REQUESTED: InterviewPrepRequestedPayload = {
  userId: OLENA_ID,
  applicationId: APPLICATION_ID,
  aiJobId: AI_JOB_ID,
  input: INTERVIEW_PREP_VACANCY,
};

describe('InterviewPrepSubscriber', () => {
  const queue = new RecordingEventQueue<InterviewPrepRequestedPayload>();
  const { log, route, routeFinal } = useSubscribedRouter([
    InterviewPrepSubscriber,
    { provide: InterviewPrepQueueService, useValue: queue },
  ]);

  beforeEach(() => {
    queue.enqueued.length = 0;
  });

  it('queues the pack of a requested event', async () => {
    await route(INTERVIEW_PREP_EVENTS.requested, REQUESTED);

    expect(queue.enqueued).toEqual([[REQUESTED, FIRST_DELIVERY]]);
  });

  it('hands the last delivery of a requested event to the queue as the final attempt', async () => {
    await routeFinal(INTERVIEW_PREP_EVENTS.requested, REQUESTED);

    expect(queue.enqueued).toEqual([[REQUESTED, FINAL_DELIVERY]]);
  });

  it('fails an event with an unknown interview kind as unrecoverable and queues nothing', async () => {
    const input = { ...INTERVIEW_PREP_VACANCY, interviewKind: 'coffee' };

    await expect(
      route(INTERVIEW_PREP_EVENTS.requested, { ...REQUESTED, input }),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(queue.enqueued).toEqual([]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({ level: 50, msg: 'interview prep event invalid' }),
    ]);
  });
});
