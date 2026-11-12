import { describe, expect, it } from 'vitest';

import { MATCH_OUTPUT } from '../../test/ai.js';
import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import { RecordingLivePublisher } from '../../test/live.js';
import { FakeMatchRepository, MATCH_JOB, matchScoredEntry, scorePushOf } from '../../test/match.js';
import { TimelineRecorder } from '../../test/recorded-events.js';
import { APPLICATION_ID, OLENA_ID, RESUME_VERSION_ID } from '../../test/service-fixtures.js';
import { NOW } from '../../test/time.js';
import { AiJobRouter, type SettledAiJob } from '../ai/index.js';
import { TimelineService } from '../events/index.js';
import { LivePublisher } from '../live/index.js';
import { MatchRepository } from './match.repository.js';
import { MatchSubscriber } from './match.subscriber.js';
import { MatchSettleService } from './match-settle.service.js';

const DONE: SettledAiJob = { job: MATCH_JOB, status: 'done', output: MATCH_OUTPUT };

const NEWER_JOB_ID = '0199f0a0-0000-7000-8000-000000000202';

async function settling() {
  const repository = new FakeMatchRepository();
  const timeline = new TimelineRecorder();
  const live = new RecordingLivePublisher();
  const moduleRef = await fakeTransactionModule({
    providers: [
      MatchSettleService,
      MatchSubscriber,
      AiJobRouter,
      { provide: MatchRepository, useValue: repository },
      { provide: TimelineService, useValue: timeline },
      { provide: LivePublisher, useValue: live },
    ],
    now: NOW,
  }).compile();
  await moduleRef.init();
  const router = moduleRef.get(AiJobRouter);
  const settle = (settled: SettledAiJob) => router.route(settled);
  return { repository, timeline, live, settle };
}

const TARGET = { applicationId: APPLICATION_ID, resumeVersionId: RESUME_VERSION_ID };

const SCORE_PUSH = scorePushOf(OLENA_ID)(APPLICATION_ID);

describe('MatchSettleService.settle', () => {
  it('writes the score for the version the job was queued for, one match_scored row on the first score and a live push each time', async () => {
    const { repository, timeline, live, settle } = await settling();

    await settle(DONE);
    await settle(DONE);

    const write = { ...TARGET, score: 59, aiJobId: MATCH_JOB.aiJobId, tx: FAKE_TRANSACTION };
    expect(repository.scores).toEqual([write, write]);
    expect(timeline.events).toEqual([
      { userId: OLENA_ID, ...matchScoredEntry(APPLICATION_ID), tx: FAKE_TRANSACTION },
    ]);
    expect(live.published).toEqual([SCORE_PUSH, SCORE_PUSH]);
  });

  it('writes no timeline row and pushes nothing when a newer match job of the application holds the score', async () => {
    const { repository, timeline, live, settle } = await settling();
    repository.newerJobId = NEWER_JOB_ID;

    await settle(DONE);

    expect([repository.scores, timeline.events, live.published]).toEqual([[], [], []]);
  });

  it.each([
    {
      case: 'the match job failed',
      settled: { job: MATCH_JOB, status: 'failed', errorType: 'no_requirements' } as const,
    },
    {
      case: 'the job names no resume version',
      settled: { ...DONE, job: { ...MATCH_JOB, resumeVersionId: undefined } },
    },
  ])('leaves the score alone when $case', async ({ settled }) => {
    const { repository, timeline, live, settle } = await settling();

    await settle(settled);

    expect([repository.scores, timeline.events, live.published]).toEqual([[], [], []]);
  });

  it('refuses an output that is not a match mapping', async () => {
    const { settle } = await settling();

    await expect(settle({ ...DONE, output: { requirements: 'all' } })).rejects.toThrow();
  });
});
