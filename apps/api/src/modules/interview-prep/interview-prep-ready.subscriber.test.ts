import { describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { AI_JOB_ID, VACANCY_JOB } from '../../test/ai.js';
import { FakeMatchReader } from '../../test/cv-hints.js';
import {
  FakeInterviewPrepRepository,
  INTERVIEW_PREP_SOURCE_ROW,
} from '../../test/interview-prep.js';
import { settlingThrough } from '../../test/notifications.js';
import { APPLICATION_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { fixedClock, minutesAfter, NOW } from '../../test/time.js';
import type { SettledAiJob } from '../ai/index.js';
import { MatchService } from '../match/index.js';
import {
  InterviewPrepRepository,
  type InterviewPrepSourceRow,
} from './interview-prep.repository.js';
import { InterviewPrepReadySubscriber } from './interview-prep-ready.subscriber.js';
import { InterviewPrepSources } from './interview-prep-sources.service.js';

const PREP_JOB = {
  ...VACANCY_JOB,
  kind: 'interview_prep',
  applicationId: APPLICATION_ID,
} satisfies SettledAiJob['job'];

const DONE: SettledAiJob = { job: PREP_JOB, status: 'done', output: {} };

async function settling(scheduledEvents = INTERVIEW_PREP_SOURCE_ROW.scheduledEvents) {
  const repository = new FakeInterviewPrepRepository();
  repository.source = { ...INTERVIEW_PREP_SOURCE_ROW, scheduledEvents };
  return settlingThrough(InterviewPrepReadySubscriber, [
    InterviewPrepSources,
    { provide: InterviewPrepRepository, useValue: repository },
    { provide: MatchService, useValue: new FakeMatchReader() },
    { provide: Clock, useValue: fixedClock(NOW) },
  ]);
}

describe('InterviewPrepReadySubscriber', () => {
  it('records interview_prep_ready once for a done pack whose interview starts within a day', async () => {
    const { notifications, settle } = await settling();

    await settle(DONE);
    await settle(DONE);

    expect(notifications.notifications).toEqual([
      {
        userId: OLENA_ID,
        type: 'interview_prep_ready',
        payload: {
          aiJobId: AI_JOB_ID,
          applicationId: APPLICATION_ID,
          company: 'Acme',
          eventKind: 'tech_interview',
          startsAt: '2026-10-23T09:00:00.000Z',
        },
      },
    ]);
  });

  it.each([
    {
      case: 'a failed pack',
      settled: { job: PREP_JOB, status: 'failed', errorType: 'ai_unavailable' },
      scheduledEvents: INTERVIEW_PREP_SOURCE_ROW.scheduledEvents,
    },
    {
      case: 'an interview more than a day ahead',
      settled: DONE,
      scheduledEvents: [{ kind: 'tech_interview', startsAt: minutesAfter(1441) }],
    },
    { case: 'no planned interview', settled: DONE, scheduledEvents: [] },
  ] satisfies {
    case: string;
    settled: SettledAiJob;
    scheduledEvents: InterviewPrepSourceRow['scheduledEvents'];
  }[])('records nothing for $case', async ({ settled, scheduledEvents }) => {
    const { notifications, settle } = await settling(scheduledEvents);

    await settle(settled);

    expect(notifications.notifications).toEqual([]);
  });
});
