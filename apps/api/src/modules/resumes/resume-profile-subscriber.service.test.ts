import { beforeEach, describe, expect, it } from 'vitest';

import { RESUME_UPLOADED } from '../../test/resumes.js';
import { FIRST_DELIVERY, OLENA_ID, RESUME_VERSION_ID } from '../../test/service-fixtures.js';
import {
  expectRefusedEvent,
  RecordingEventQueue,
  useSubscribedRouter,
} from '../../test/subscriber.js';
import { AiJobRouter } from '../ai/index.js';
import { ResumeProfileService } from './resume-profile.service.js';
import { ResumeProfileQueueService } from './resume-profile-queue.service.js';
import { ResumeProfileSubscriber } from './resume-profile-subscriber.service.js';
import type { ResumeVersionUploadedPayload } from './resumes.events.js';

const EVENT = 'resume.version_uploaded';

describe('ResumeProfileSubscriber', () => {
  const queue = new RecordingEventQueue<ResumeVersionUploadedPayload>();
  const router = useSubscribedRouter([
    ResumeProfileSubscriber,
    AiJobRouter,
    { provide: ResumeProfileQueueService, useValue: queue },
    { provide: ResumeProfileService, useValue: {} },
  ]);

  beforeEach(() => {
    queue.enqueued.length = 0;
  });

  it('queues the profile of an uploaded version with its delivery', async () => {
    await router.route(EVENT, RESUME_UPLOADED);

    expect(queue.enqueued).toEqual([[RESUME_UPLOADED, FIRST_DELIVERY]]);
  });

  it.each([
    {
      payload: 'without an ai job id',
      data: { userId: OLENA_ID, resumeVersionId: RESUME_VERSION_ID },
    },
    { payload: 'that is no object', data: undefined },
  ])('fails an event $payload as unrecoverable and queues nothing', async ({ data }) => {
    const message = 'resume upload event invalid';
    await expectRefusedEvent(router, { type: EVENT, payload: data, message });

    expect(queue.enqueued).toEqual([]);
  });
});
