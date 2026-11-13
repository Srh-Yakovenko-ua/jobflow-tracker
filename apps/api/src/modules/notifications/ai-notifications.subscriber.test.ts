import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AI_JOB_ID, VACANCY_JOB } from '../../test/ai.js';
import { MATCH_JOB } from '../../test/match.js';
import { RecordingNotifications } from '../../test/notifications.js';
import { APPLICATION_ID, OLENA_ID, RESUME_VERSION_ID } from '../../test/service-fixtures.js';
import { AiJobRouter, type SettledAiJob } from '../ai/index.js';
import { AiNotificationsSubscriber } from './ai-notifications.subscriber.js';
import { NotificationsService } from './notifications.service.js';

const DRAFT_JOB = { ...VACANCY_JOB, applicationId: APPLICATION_ID };

const RESUME_JOB = {
  ...VACANCY_JOB,
  kind: 'resume_parse',
  resumeVersionId: RESUME_VERSION_ID,
} satisfies SettledAiJob['job'];

const FAILED: SettledAiJob = { job: DRAFT_JOB, status: 'failed', errorType: 'ai_unavailable' };

async function settling() {
  const notifications = new RecordingNotifications();
  const moduleRef = await Test.createTestingModule({
    providers: [
      AiNotificationsSubscriber,
      AiJobRouter,
      { provide: NotificationsService, useValue: notifications },
    ],
  }).compile();
  await moduleRef.init();
  const router = moduleRef.get(AiJobRouter);
  return { notifications, settle: (settled: SettledAiJob) => router.route(settled) };
}

describe('AiNotificationsSubscriber', () => {
  it.each([
    {
      case: 'a parsed vacancy of a draft',
      job: DRAFT_JOB,
      payload: { aiJobId: AI_JOB_ID, kind: 'vacancy_parse', applicationId: APPLICATION_ID },
    },
    {
      case: 'a parsed resume version',
      job: RESUME_JOB,
      payload: { aiJobId: AI_JOB_ID, kind: 'resume_parse', resumeVersionId: RESUME_VERSION_ID },
    },
  ])('records ai_done for $case', async ({ job, payload }) => {
    const { notifications, settle } = await settling();

    await settle({ job, status: 'done', output: {} });

    expect(notifications.notifications).toEqual([{ userId: OLENA_ID, type: 'ai_done', payload }]);
  });

  it('records ai_failed with the error type of a failed job', async () => {
    const { notifications, settle } = await settling();

    await settle(FAILED);

    expect(notifications.notifications).toEqual([
      {
        userId: OLENA_ID,
        type: 'ai_failed',
        payload: {
          aiJobId: AI_JOB_ID,
          kind: 'vacancy_parse',
          applicationId: APPLICATION_ID,
          errorType: 'ai_unavailable',
        },
      },
    ]);
  });

  it('records a failed job settled again on its retry once', async () => {
    const { notifications, settle } = await settling();

    await settle(FAILED);
    await settle(FAILED);

    expect(notifications.notifications.map(({ type }) => type)).toEqual(['ai_failed']);
  });

  it('records nothing for a settled match job', async () => {
    const { notifications, settle } = await settling();

    await settle({ job: MATCH_JOB, status: 'done', output: {} });

    expect(notifications.notifications).toEqual([]);
  });
});
