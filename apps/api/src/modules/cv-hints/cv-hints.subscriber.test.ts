import { CV_HINTS_INPUT } from '@jobflow/shared/testing';
import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { AI_JOB_ID } from '../../test/ai.js';
import {
  APPLICATION_ID,
  FINAL_DELIVERY,
  FIRST_DELIVERY,
  OLENA_ID,
  RESUME_VERSION_ID,
} from '../../test/service-fixtures.js';
import { RecordingEventQueue, useSubscribedRouter } from '../../test/subscriber.js';
import type { CvHintsRequestedPayload } from './cv-hints.events.js';
import { CvHintsSubscriber } from './cv-hints.subscriber.js';
import { CvHintsQueueService } from './cv-hints-queue.service.js';

const EVENT = 'application.cv_hints_requested';

const REQUESTED: CvHintsRequestedPayload = {
  userId: OLENA_ID,
  applicationId: APPLICATION_ID,
  resumeVersionId: RESUME_VERSION_ID,
  aiJobId: AI_JOB_ID,
  input: CV_HINTS_INPUT,
};

describe('CvHintsSubscriber', () => {
  const queue = new RecordingEventQueue<CvHintsRequestedPayload>();
  const { log, route, routeFinal } = useSubscribedRouter([
    CvHintsSubscriber,
    { provide: CvHintsQueueService, useValue: queue },
  ]);

  beforeEach(() => {
    queue.enqueued.length = 0;
  });

  it('queues the hints of a requested event', async () => {
    await route(EVENT, REQUESTED);

    expect(queue.enqueued).toEqual([[REQUESTED, FIRST_DELIVERY]]);
  });

  it('hands the last delivery of a requested event to the queue as the final attempt', async () => {
    await routeFinal(EVENT, REQUESTED);

    expect(queue.enqueued).toEqual([[REQUESTED, FINAL_DELIVERY]]);
  });

  it.each([
    { case: 'no linked version', payload: { ...REQUESTED, resumeVersionId: undefined } },
    {
      case: 'an input with a requirement of unknown coverage',
      payload: {
        ...REQUESTED,
        input: {
          ...CV_HINTS_INPUT,
          requirements: [{ name: 'GraphQL', weight: 'nice', coverage: 'some', pointsLost: 5 }],
        },
      },
    },
  ])('fails an event with $case as unrecoverable and queues nothing', async ({ payload }) => {
    await expect(route(EVENT, payload)).rejects.toBeInstanceOf(UnrecoverableError);

    expect(queue.enqueued).toEqual([]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({ level: 50, msg: 'cv hints event invalid' }),
    ]);
  });
});
