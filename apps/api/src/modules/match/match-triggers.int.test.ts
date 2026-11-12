import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplicationContext } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { OutboxRelayService } from '../../outbox/outbox-relay.service.js';
import { AI_JOB_ID, FakeAiClient, MATCH_COMPLETION, RESUME_PROFILE } from '../../test/ai.js';
import { useTestApp } from '../../test/app.js';
import { applicationPath, signedInWithSearch } from '../../test/applications.js';
import { createActiveResumeVersion, createApplicationRows } from '../../test/factories.js';
import { callRoute } from '../../test/http.js';
import { RecordingLivePublisher } from '../../test/live.js';
import { MATCHABLE_ROW, scorePushOf } from '../../test/match.js';
import { memoryLog } from '../../test/memory-log.js';
import { useTestWorkers } from '../../test/worker.js';
import { AiClient, AiJobRouter } from '../ai/index.js';
import { LivePublisher } from '../live/index.js';

const WORKER_TEST = { timeout: 45_000 };

const SETTLED = { timeout: 30_000 };

const log = memoryLog();

const ai = new FakeAiClient();

const live = new RecordingLivePublisher();

describe('match score triggers', () => {
  const testApp = useTestApp();
  const workers = useTestWorkers(log.sink, (builder) =>
    builder.overrideProvider(AiClient).useValue(ai).overrideProvider(LivePublisher).useValue(live),
  );

  beforeEach(() => {
    ai.calls.length = 0;
    ai.answer = () => Promise.resolve(MATCH_COMPLETION);
    live.published.length = 0;
  });

  async function ownerWithActiveVersion() {
    const owner = await signedInWithSearch(testApp.prisma);
    const resumeVersionId = await createActiveResumeVersion(testApp.prisma, owner.userId);
    return { ...owner, resumeVersionId };
  }

  async function startedWorker(): Promise<INestApplicationContext> {
    return (await workers.compile()).init();
  }

  const relayed = (worker: INestApplicationContext) =>
    worker.get(OutboxRelayService, { strict: false }).relay();

  const scoredStateOf = (ids: string[]) =>
    testApp.prisma.application.findMany({
      where: { id: { in: ids } },
      select: {
        resumeVersionId: true,
        matchScore: true,
        _count: { select: { timelineEvents: { where: { kind: 'match_scored' } } } },
      },
    });

  it(
    'scores every existing application once the active first CV is profiled',
    WORKER_TEST,
    async () => {
      const owner = await ownerWithActiveVersion();
      const ids = await createApplicationRows(testApp.prisma, {
        ...owner,
        rows: [MATCHABLE_ROW, MATCHABLE_ROW],
      });
      const worker = await startedWorker();

      await worker.get(AiJobRouter, { strict: false }).route({
        job: {
          aiJobId: AI_JOB_ID,
          userId: owner.userId,
          kind: 'resume_parse',
          input: {},
          resumeVersionId: owner.resumeVersionId,
        },
        status: 'done',
        output: RESUME_PROFILE,
      });
      await relayed(worker);

      const scored = {
        resumeVersionId: owner.resumeVersionId,
        matchScore: 59,
        _count: { timelineEvents: 1 },
      };
      await expect.poll(() => scoredStateOf(ids), SETTLED).toEqual([scored, scored]);
      expect(live.published).toEqual(expect.arrayContaining(ids.map(scorePushOf(owner.userId))));
    },
  );

  it('three stack edits within the debounce make one match job', WORKER_TEST, async () => {
    const owner = await ownerWithActiveVersion();
    const { resumeVersionId, accessToken } = owner;
    await testApp.prisma.resumeVersion.update({
      where: { id: resumeVersionId },
      data: { aiProfile: RESUME_PROFILE },
    });
    const [applicationId = ''] = await createApplicationRows(testApp.prisma, {
      ...owner,
      rows: [{ ...MATCHABLE_ROW, resumeVersionId }],
    });
    const worker = await startedWorker();
    const path = applicationPath(applicationId);
    const editStack = (stack: string[]) =>
      callRoute(testApp.app, { method: 'patch', path, body: { stack }, accessToken });

    const statuses = [
      (await editStack(['React', 'GraphQL'])).status,
      (await editStack(['React', 'GraphQL', 'AWS'])).status,
      (await editStack(['React', 'AWS'])).status,
    ];
    await relayed(worker);

    expect(statuses).toEqual([200, 200, 200]);
    await expect
      .poll(async () => (await scoredStateOf([applicationId]))[0]?.matchScore, SETTLED)
      .toBe(59);
    const matchQueue = worker.get<Queue>(getQueueToken('match'), { strict: false });
    expect({
      matchJobs: await testApp.prisma.aiJob.count({ where: { applicationId, kind: 'match' } }),
      aiCalls: ai.calls.length,
      delayedTriggers: await matchQueue.getDelayedCount(),
    }).toEqual({ matchJobs: 1, aiCalls: 1, delayedTriggers: 0 });
  });
});
