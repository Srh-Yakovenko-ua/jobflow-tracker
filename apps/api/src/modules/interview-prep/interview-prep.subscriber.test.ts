import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { AI_JOB_ID } from '../../test/ai.js';
import { INTERVIEW_PREP_VACANCY } from '../../test/interview-prep.js';
import { APPLICATION_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { useSubscribedRouter } from '../../test/subscriber.js';
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
  const enqueued: InterviewPrepRequestedPayload[] = [];
  const { log, route } = useSubscribedRouter([
    InterviewPrepSubscriber,
    {
      provide: InterviewPrepQueueService,
      useValue: { enqueue: (payload: InterviewPrepRequestedPayload) => enqueued.push(payload) },
    },
  ]);

  beforeEach(() => {
    enqueued.length = 0;
  });

  it('queues the pack of a requested event', async () => {
    await route(INTERVIEW_PREP_EVENTS.requested, REQUESTED);

    expect(enqueued).toEqual([REQUESTED]);
  });

  it('fails an event with an unknown interview kind as unrecoverable and queues nothing', async () => {
    const input = { ...INTERVIEW_PREP_VACANCY, interviewKind: 'coffee' };

    await expect(
      route(INTERVIEW_PREP_EVENTS.requested, { ...REQUESTED, input }),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(enqueued).toEqual([]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({ level: 50, msg: 'interview prep event invalid' }),
    ]);
  });
});
