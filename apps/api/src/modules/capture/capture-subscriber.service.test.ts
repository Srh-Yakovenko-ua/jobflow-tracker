import { beforeEach, describe, expect, it } from 'vitest';

import { CAPTURE_REQUESTED } from '../../test/capture.js';
import { APPLICATION_ID, FIRST_DELIVERY, OLENA_ID } from '../../test/service-fixtures.js';
import {
  expectRefusedEvent,
  RecordingEventQueue,
  useSubscribedRouter,
} from '../../test/subscriber.js';
import { AiJobRouter } from '../ai/index.js';
import type { ApplicationCaptureRequestedPayload } from '../applications/index.js';
import { CaptureParseService } from './capture-parse.service.js';
import { CaptureQueueService } from './capture-queue.service.js';
import { CaptureSubscriber } from './capture-subscriber.service.js';

const EVENT = 'application.capture_requested';

describe('CaptureSubscriber', () => {
  const queue = new RecordingEventQueue<ApplicationCaptureRequestedPayload>();
  const router = useSubscribedRouter([
    CaptureSubscriber,
    AiJobRouter,
    { provide: CaptureQueueService, useValue: queue },
    { provide: CaptureParseService, useValue: {} },
  ]);

  beforeEach(() => {
    queue.enqueued.length = 0;
  });

  it('queues the parse of a capture request with its delivery', async () => {
    await router.route(EVENT, CAPTURE_REQUESTED);

    expect(queue.enqueued).toEqual([[CAPTURE_REQUESTED, FIRST_DELIVERY]]);
  });

  it.each([
    { payload: 'without an ai job id', data: { userId: OLENA_ID, applicationId: APPLICATION_ID } },
    { payload: 'that is no object', data: undefined },
  ])('fails an event $payload as unrecoverable and adds nothing', async ({ data }) => {
    const message = 'capture event invalid';
    await expectRefusedEvent(router, { type: EVENT, payload: data, message });

    expect(queue.enqueued).toEqual([]);
  });
});
