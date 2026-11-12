import { applicationMatchResponseSchema, type ResumeParseOutput } from '@jobflow/shared';
import type { INestApplicationContext } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  AI_RESULTS_PATH,
  FakeAiClient,
  MATCH_COMPLETION,
  MATCH_OUTPUT,
  RESUME_PROFILE,
  storedAiJob,
} from '../../test/ai.js';
import { useTestApp } from '../../test/app.js';
import { applicationPath, signedInWithSearch } from '../../test/applications.js';
import {
  createAiJob,
  createAiResult,
  createApplicationRows,
  createResume,
  resumeVersionData,
} from '../../test/factories.js';
import { callRoute, statusAndType } from '../../test/http.js';
import { MATCHABLE_ROW } from '../../test/match.js';
import { memoryLog } from '../../test/memory-log.js';
import { NOW } from '../../test/time.js';
import { useTestWorkers } from '../../test/worker.js';
import { AiClient } from '../ai/index.js';
import { MatchRepository } from './match.repository.js';
import { MatchQueueService } from './match-queue.service.js';

const WORKER_TEST = { timeout: 30_000 };

const SETTLED = { timeout: 20_000 };

const SENIOR_PROFILE: ResumeParseOutput = { ...RESUME_PROFILE, seniority: 'senior', totalYears: 6 };

const log = memoryLog();

const ai = new FakeAiClient();

type Linked = {
  userId: string;
  searchId: string;
  accessToken: string;
  resumeId: string;
  applicationId: string;
  resumeVersionId: string;
};

const matchPath = (id: string) => `${applicationPath(id)}/match`;

describe('the Match Score of an application', () => {
  const testApp = useTestApp();
  const workers = useTestWorkers(log.sink, (builder) =>
    builder.overrideProvider(AiClient).useValue(ai),
  );

  beforeEach(() => {
    ai.calls.length = 0;
    ai.answer = () => Promise.resolve(MATCH_COMPLETION);
  });

  async function versionOf(
    { userId, resumeId }: Pick<Linked, 'userId' | 'resumeId'>,
    number: number,
  ) {
    const base = resumeVersionData({ userId, resumeId });
    const version = await testApp.prisma.resumeVersion.create({
      data: {
        ...base,
        number,
        title: `CV v${String(number)}`,
        storageKey: `${base.storageKey}.${String(number)}`,
        aiProfile: number === 1 ? RESUME_PROFILE : SENIOR_PROFILE,
      },
    });
    return version.id;
  }

  async function linkedApplication(): Promise<Linked> {
    const { prisma } = testApp;
    const owner = await signedInWithSearch(prisma);
    const resumeId = await createResume(prisma, owner.userId);
    const resumeVersionId = await versionOf({ ...owner, resumeId }, 1);
    const [applicationId = ''] = await createApplicationRows(prisma, {
      ...owner,
      rows: [{ ...MATCHABLE_ROW, resumeVersionId }],
    });
    return { ...owner, resumeId, applicationId, resumeVersionId };
  }

  async function startedWorker(): Promise<INestApplicationContext> {
    return (await workers.compile()).init();
  }

  async function requested(worker: INestApplicationContext, { userId, applicationId }: Linked) {
    const queue = worker.get(MatchQueueService, { strict: false });
    const aiJobId = await queue.request(userId, { applicationId });
    if (aiJobId === null) {
      throw new Error('no match job queued');
    }
    return aiJobId;
  }

  async function settled(aiJobId: string) {
    await expect
      .poll(async () => (await storedAiJob(testApp.prisma, aiJobId)).status, SETTLED)
      .toMatch(/^(done|failed)$/);
    return aiJobId;
  }

  async function matched(worker: INestApplicationContext, owner: Linked) {
    return settled(await requested(worker, owner));
  }

  const scoreOf = async (applicationId: string) =>
    (
      await testApp.prisma.application.findUniqueOrThrow({
        where: { id: applicationId },
        select: { matchScore: true },
      })
    ).matchScore;

  const matchResultsOf = (userId: string) =>
    testApp.prisma.aiResult.findMany({
      where: { userId, kind: 'match' },
      select: { id: true, inputHash: true },
    });

  const getMatch = (accessToken: string | undefined, id: string) =>
    callRoute(testApp.app, { method: 'get', path: matchPath(id), accessToken });

  async function readBody(owner: Linked) {
    const response = await getMatch(owner.accessToken, owner.applicationId);
    expect(response.status).toBe(200);
    return applicationMatchResponseSchema.parse(response.body);
  }

  const readMatch = async (owner: Linked) => (await readBody(owner)).match;

  async function relinked(owner: Linked, number: number) {
    const resumeVersionId = await versionOf(owner, number);
    await testApp.prisma.application.update({
      where: { id: owner.applicationId },
      data: { resumeVersionId },
    });
    return resumeVersionId;
  }

  it(
    'writes the score from the mapping and answers the breakdown, and the same inputs twice make one AI call and keep both jobs',
    WORKER_TEST,
    async () => {
      const owner = await linkedApplication();
      const worker = await startedWorker();

      const first = await matched(worker, owner);
      const second = await matched(worker, owner);

      expect(ai.calls).toEqual([expect.objectContaining({ kind: 'match' })]);
      expect(await matchResultsOf(owner.userId)).toHaveLength(1);
      expect(await scoreOf(owner.applicationId)).toBe(59);
      const jobs = await Promise.all([first, second].map((id) => storedAiJob(testApp.prisma, id)));
      expect(jobs.map(({ status }) => status)).toEqual(['done', 'done']);
      expect(new Set(jobs.map(({ aiResultId }) => aiResultId)).size).toBe(1);
      expect(await readMatch(owner)).toMatchObject({
        score: 59,
        missing: [
          { name: 'AWS / інфраструктура', weight: 'must', pointsLost: 27 },
          { name: 'Досвід ліда команди 3+', weight: 'nice', pointsLost: 9 },
        ],
        explanation: MATCH_OUTPUT.explanation,
        resumeVersion: { id: owner.resumeVersionId, number: 1, title: 'CV v1' },
        computedAt: jobs[1]?.finishedAt?.toISOString(),
      });
    },
  );

  it(
    'answers the match job queued for the linked version, then done beside the score once it settles',
    WORKER_TEST,
    async () => {
      const owner = await linkedApplication();
      const worker = await workers.compile();

      const aiJobId = await requested(worker, owner);
      const whileQueued = await readBody(owner);
      await worker.init();
      await settled(aiJobId);

      expect(whileQueued).toEqual({ match: null, job: { id: aiJobId, status: 'queued' } });
      expect(await readBody(owner)).toMatchObject({
        match: { score: 59 },
        job: { id: aiJobId, status: 'done' },
      });
    },
  );

  it('answers no match and no job for a newly linked version that has no match job', async () => {
    const owner = await seededMatch(await linkedApplication());

    await relinked(owner, 2);

    expect(await readBody(owner)).toEqual({ match: null, job: null });
  });

  it(
    'calls the AI again with a new input hash after a stack edit and after a relink to a version with another profile',
    WORKER_TEST,
    async () => {
      const owner = await linkedApplication();
      const worker = await startedWorker();
      const { application } = testApp.prisma;
      const where = { id: owner.applicationId };

      await matched(worker, owner);
      await application.update({ where, data: { stack: ['React', 'GraphQL'] } });
      await matched(worker, owner);
      const secondVersionId = await relinked(owner, 2);
      await matched(worker, owner);

      expect(ai.calls).toHaveLength(3);
      const hashes = (await matchResultsOf(owner.userId)).map(({ inputHash }) => inputHash);
      expect(new Set(hashes).size).toBe(3);
      expect(await readMatch(owner)).toMatchObject({
        resumeVersion: { id: secondVersionId, number: 2 },
      });
    },
  );

  it(
    'leaves the score unwritten when the application is relinked before the match settles',
    WORKER_TEST,
    async () => {
      const owner = await linkedApplication();
      const secondVersionId = await versionOf(owner, 2);
      let release: () => void = () => undefined;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      ai.answer = async () => {
        await held;
        return MATCH_COMPLETION;
      };
      const worker = await startedWorker();

      const settled = matched(worker, owner);
      await expect.poll(() => ai.calls.length, SETTLED).toBe(1);
      await testApp.prisma.application.update({
        where: { id: owner.applicationId },
        data: { resumeVersionId: secondVersionId },
      });
      release();
      expect((await storedAiJob(testApp.prisma, await settled)).status).toBe('done');

      expect(await scoreOf(owner.applicationId)).toBeNull();
      expect(await readMatch(owner)).toBeNull();
    },
  );

  it('queues no job, clears a stale score and answers no match when no CV is linked', async () => {
    const owner = await linkedApplication();
    await testApp.prisma.application.update({
      where: { id: owner.applicationId },
      data: { resumeVersionId: null, matchScore: 70 },
    });
    const queue = (await workers.compile()).get(MatchQueueService, { strict: false });

    expect(await queue.request(owner.userId, { applicationId: owner.applicationId })).toBeNull();

    expect(await testApp.prisma.aiJob.count({ where: { userId: owner.userId } })).toBe(0);
    expect(await scoreOf(owner.applicationId)).toBeNull();
    expect(await readMatch(owner)).toBeNull();
  });

  it('answers no match once the AI results are deleted', async () => {
    const owner = await seededMatch(await linkedApplication());

    const deleted = await callRoute(testApp.app, {
      method: 'delete',
      path: AI_RESULTS_PATH,
      accessToken: owner.accessToken,
    });

    expect(deleted.status).toBe(204);
    expect(await readMatch(owner)).toBeNull();
  });

  async function seededMatch(owner: Linked): Promise<Linked> {
    const { prisma } = testApp;
    const aiResultId = await createAiResult(prisma, {
      userId: owner.userId,
      kind: 'match',
      output: MATCH_OUTPUT,
    });
    await createAiJob(prisma, {
      userId: owner.userId,
      applicationId: owner.applicationId,
      resumeVersionId: owner.resumeVersionId,
      kind: 'match',
      status: 'done',
      aiResultId,
      finishedAt: NOW,
    });
    return owner;
  }

  it('answers no token with 401, another user with 404 and a malformed id with 422', async () => {
    const olena = await seededMatch(await linkedApplication());
    const bohdan = await signedInWithSearch(testApp.prisma);

    const responses = await Promise.all([
      getMatch(undefined, olena.applicationId),
      getMatch(bohdan.accessToken, olena.applicationId),
      getMatch(olena.accessToken, 'not-a-uuid'),
    ]);

    expect(responses.map(statusAndType)).toEqual([
      [401, 'unauthorized'],
      [404, 'not_found'],
      [422, 'validation_error'],
    ]);
    expect((await readMatch(olena))?.score).toBe(59);
  });

  it("reads and writes OLENA's match rows for OLENA only", async () => {
    const olena = await seededMatch(await linkedApplication());
    const bohdan = await signedInWithSearch(testApp.prisma);
    const repository = testApp.app.get(MatchRepository);
    const { applicationId, resumeVersionId } = olena;
    const { id: aiJobId } = await testApp.prisma.aiJob.findFirstOrThrow({
      where: { applicationId },
    });
    const write = { applicationId, resumeVersionId, score: 40, aiJobId };

    const asBohdan = await Promise.all([
      repository.findSource(bohdan.userId, applicationId),
      repository.findLatest(bohdan.userId, { applicationId, resumeVersionId }),
      repository.findLatestJob(bohdan.userId, { applicationId, resumeVersionId }),
      repository.saveScore(bohdan.userId, write),
    ]);
    const asOlena = await Promise.all([
      repository.findLatest(olena.userId, { applicationId, resumeVersionId }),
      repository.findLatestJob(olena.userId, { applicationId, resumeVersionId }),
      repository.saveScore(olena.userId, write),
    ]);

    expect(asBohdan).toEqual([null, null, null, 0]);
    expect(asOlena).toEqual([
      expect.objectContaining({ finishedAt: NOW }),
      { id: aiJobId, status: 'done' },
      1,
    ]);
    expect(await scoreOf(applicationId)).toBe(40);
  });

  it("leaves OLENA's stale score to OLENA when BOHDAN clears it", async () => {
    const olena = await linkedApplication();
    const bohdan = await signedInWithSearch(testApp.prisma);
    await testApp.prisma.application.update({
      where: { id: olena.applicationId },
      data: { resumeVersionId: null, matchScore: 70 },
    });
    const repository = testApp.app.get(MatchRepository);

    expect(await repository.clearScore(bohdan.userId, olena.applicationId)).toBe(0);
    expect(await scoreOf(olena.applicationId)).toBe(70);
  });
});
