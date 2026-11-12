import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecordingMatchTriggers } from '../../test/match.js';
import {
  APPLICATION_ID,
  MOVE_EVENT_ID,
  OLENA_ID,
  RESUME_VERSION_ID,
} from '../../test/service-fixtures.js';
import { useSubscribedRouter } from '../../test/subscriber.js';
import { MatchTriggerService } from './match-trigger.service.js';
import { MatchTriggerSubscriber } from './match-trigger.subscriber.js';

const OF_APPLICATION = { userId: OLENA_ID, applicationId: APPLICATION_ID };

const SCHEDULED = [{ userId: OLENA_ID, applicationIds: [APPLICATION_ID] }];

describe('MatchTriggerSubscriber', () => {
  const triggers = new RecordingMatchTriggers();
  const { log, route } = useSubscribedRouter([
    MatchTriggerSubscriber,
    { provide: MatchTriggerService, useValue: triggers },
  ]);

  beforeEach(() => {
    triggers.scheduled.length = 0;
    triggers.rematched.length = 0;
  });

  it.each([
    { type: 'application.created', payload: OF_APPLICATION, scheduled: SCHEDULED },
    {
      type: 'application.updated',
      payload: { ...OF_APPLICATION, fields: ['company', 'stack'] },
      scheduled: SCHEDULED,
    },
    {
      type: 'application.updated',
      payload: { ...OF_APPLICATION, fields: ['position'] },
      scheduled: SCHEDULED,
    },
    {
      type: 'application.updated',
      payload: { ...OF_APPLICATION, fields: ['rawText'] },
      scheduled: SCHEDULED,
    },
    {
      type: 'application.updated',
      payload: { ...OF_APPLICATION, fields: ['isDraft'] },
      scheduled: SCHEDULED,
    },
    {
      type: 'application.updated',
      payload: { ...OF_APPLICATION, fields: ['deletedAt'] },
      scheduled: [],
    },
    {
      type: 'application.updated',
      payload: { ...OF_APPLICATION, fields: ['matchScore'] },
      scheduled: [],
    },
    {
      type: 'application.updated',
      payload: { ...OF_APPLICATION, fields: ['company', 'salaryMin'] },
      scheduled: [],
    },
    {
      type: 'resume.attached',
      payload: { ...OF_APPLICATION, resumeVersionId: RESUME_VERSION_ID },
      scheduled: SCHEDULED,
    },
    { type: 'application.stage_changed', payload: OF_APPLICATION, scheduled: [] },
  ])(
    'schedules $scheduled.length match triggers for $type with $payload.fields',
    async ({ type, payload, scheduled }) => {
      await route(type, payload);

      expect(triggers.scheduled).toEqual(scheduled);
      expect(triggers.rematched).toEqual([]);
    },
  );

  it('rematches every application of the version on resume.version_profiled', async () => {
    await route('resume.version_profiled', {
      userId: OLENA_ID,
      resumeVersionId: RESUME_VERSION_ID,
    });

    expect(triggers.rematched).toEqual([{ userId: OLENA_ID, resumeVersionId: RESUME_VERSION_ID }]);
    expect(triggers.scheduled).toEqual([]);
  });

  it.each([
    { type: 'application.created', payload: { userId: OLENA_ID } },
    { type: 'application.updated', payload: OF_APPLICATION },
    { type: 'resume.attached', payload: OF_APPLICATION },
    { type: 'resume.version_profiled', payload: { userId: OLENA_ID } },
  ])(
    'fails an invalid $type event as unrecoverable and triggers nothing',
    async ({ type, payload }) => {
      await expect(route(type, payload)).rejects.toBeInstanceOf(UnrecoverableError);

      expect([triggers.scheduled, triggers.rematched]).toEqual([[], []]);
      expect(log.parsed()).toEqual([
        expect.objectContaining({
          level: 50,
          msg: 'match trigger event invalid',
          eventId: MOVE_EVENT_ID,
        }),
      ]);
    },
  );
});
