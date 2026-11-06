import type { AiJobStatus } from '@jobflow/shared';
import { ConfigService } from '@nestjs/config';
import type { TestingModule } from '@nestjs/testing';
import { UnrecoverableError } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { validateEnv } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QUEUES } from '../../queues/queues.js';
import { FakeAiClient, VACANCY_TEXT } from '../../test/ai.js';
import { useTestDatabase } from '../../test/database.js';
import { exampleEnv } from '../../test/example-env.js';
import {
  createAiJob,
  createAiResult,
  createOwnedApplication,
  type OwnedApplication,
} from '../../test/factories.js';
import { memoryLog } from '../../test/memory-log.js';
import { processedJob } from '../../test/processed-job.js';
import { compileProcessorModule } from '../../test/processor.js';
import { minutesBefore, NOW } from '../../test/time.js';
import { AI_JOBS, type AiCompleteJob } from './ai.jobs.js';
import { AiProcessor } from './ai.processor.js';
import { AiRepository } from './ai.repository.js';
import { AiService } from './ai.service.js';
import { AiClient } from './ai-client.js';
import { aiInputHash } from './ai-input-hash.js';

const BUDGET = { AI_DAILY_LIMIT: '1', AI_MONTHLY_TOKEN_CAP: '1000' };

const OTHER_VACANCY = 'Middle Node.js developer, Globex, Kyiv, 3000 USD';

const AI_JOB_ROW = { status: true, errorType: true, aiResultId: true, finishedAt: true } as const;

type JobInLine = { owner: OwnedApplication; status: AiJobStatus; minutesAgo: number };

const log = memoryLog();

const database = useTestDatabase();

const ai = new FakeAiClient();

let moduleRef: TestingModule;

beforeAll(async () => {
  moduleRef = await compileProcessorModule(log.sink, [
    AiProcessor,
    AiService,
    AiRepository,
    { provide: Clock, useValue: { now: () => NOW } },
    { provide: PrismaService, useValue: database.prisma },
    {
      provide: ConfigService,
      useValue: new ConfigService(validateEnv({ ...exampleEnv, ...BUDGET })),
    },
    { provide: AiClient, useValue: ai },
  ]);
});

beforeEach(() => {
  ai.calls.length = 0;
});

afterAll(() => moduleRef.close());

async function queuedJob(owner: OwnedApplication, text: string): Promise<AiCompleteJob> {
  const { userId, applicationId } = owner;
  const aiJobId = await createAiJob(database.prisma, { userId, applicationId, status: 'queued' });
  return { aiJobId, userId, kind: 'vacancy_parse', input: { text } };
}

function run(job: AiCompleteJob) {
  const data = { queueName: QUEUES.ai.name, name: AI_JOBS.complete, data: job, id: job.aiJobId };
  return moduleRef.get(AiProcessor).process(processedJob(data));
}

function storedJob(id: string) {
  return database.prisma.aiJob.findUniqueOrThrow({ where: { id }, select: AI_JOB_ROW });
}

function jobInLine({ owner, status, minutesAgo }: JobInLine): Promise<string> {
  const { userId, applicationId } = owner;
  const createdAt = minutesBefore(minutesAgo);
  return createAiJob(database.prisma, { userId, applicationId, status, createdAt });
}

describe('AiService on Postgres', () => {
  it('calls services/ai once for the same vacancy pasted twice and finishes both jobs with one result', async () => {
    const olena = await createOwnedApplication(database.prisma);
    const first = await queuedJob(olena, VACANCY_TEXT);
    const pastedAgain = await queuedJob(olena, `\n  ${VACANCY_TEXT.replaceAll(' ', '   ')}\n\n`);

    await expect(run(first)).resolves.toMatchObject({ cached: false });
    await expect(run(pastedAgain)).resolves.toMatchObject({ cached: true });

    expect(ai.calls).toHaveLength(1);
    const [result, ...others] = await database.prisma.aiResult.findMany();
    expect(others).toEqual([]);
    expect(result).toMatchObject({
      userId: olena.userId,
      status: 'succeeded',
      model: 'fake',
      tokensIn: 120,
      tokensOut: 40,
    });
    const done = { status: 'done', errorType: null, aiResultId: result?.id, finishedAt: NOW };
    expect([await storedJob(first.aiJobId), await storedJob(pastedAgain.aiJobId)]).toEqual([
      done,
      done,
    ]);
  });

  it('asks services/ai again for a vacancy whose call failed yesterday and stores the answer over the failed result', async () => {
    const olena = await createOwnedApplication(database.prisma);
    const job = await queuedJob(olena, VACANCY_TEXT);
    const failedId = await createAiResult(database.prisma, {
      userId: olena.userId,
      inputHash: aiInputHash(job),
      status: 'failed',
      error: 'not_ready',
      output: Prisma.DbNull,
      model: '',
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 0,
      updatedAt: new Date('2026-10-21T23:59:00.000Z'),
    });

    await expect(run(job)).resolves.toMatchObject({ aiResultId: failedId, cached: false });

    expect(ai.calls).toHaveLength(1);
    expect(await database.prisma.aiResult.findMany()).toEqual([
      expect.objectContaining({
        id: failedId,
        status: 'succeeded',
        error: null,
        model: 'fake',
        tokensIn: 120,
        tokensOut: 40,
      }),
    ]);
    expect(await storedJob(job.aiJobId)).toEqual({
      status: 'done',
      errorType: null,
      aiResultId: failedId,
      finishedAt: NOW,
    });
  });

  it('fails a second vacancy over the daily limit with budget_exceeded and still serves a cached one', async () => {
    const olena = await createOwnedApplication(database.prisma);
    const first = await queuedJob(olena, VACANCY_TEXT);
    const other = await queuedJob(olena, OTHER_VACANCY);
    const again = await queuedJob(olena, VACANCY_TEXT);

    await run(first);
    const refusal = await run(other).catch((thrown: unknown) => thrown);
    await expect(run(again)).resolves.toMatchObject({ cached: true });

    expect(refusal).toBeInstanceOf(UnrecoverableError);
    expect(refusal).toHaveProperty('message', 'budget_exceeded');
    expect(ai.calls).toHaveLength(1);
    expect(await storedJob(other.aiJobId)).toEqual({
      status: 'failed',
      errorType: 'budget_exceeded',
      aiResultId: null,
      finishedAt: NOW,
    });
    expect(await storedJob(again.aiJobId)).toMatchObject({ status: 'done' });
  });

  it('fails a call with budget_exceeded once all users together reached the monthly token cap', async () => {
    const bohdan = await createOwnedApplication(database.prisma);
    await createAiResult(database.prisma, {
      userId: bohdan.userId,
      tokensIn: 600,
      tokensOut: 400,
      updatedAt: minutesBefore(60),
    });
    const olena = await createOwnedApplication(database.prisma);
    const job = await queuedJob(olena, VACANCY_TEXT);

    await expect(run(job)).rejects.toThrow(new UnrecoverableError('budget_exceeded'));

    expect(ai.calls).toEqual([]);
    expect(await storedJob(job.aiJobId)).toMatchObject({ errorType: 'budget_exceeded' });
  });

  it("leaves yesterday's calls and last month's tokens out of the budget", async () => {
    const olena = await createOwnedApplication(database.prisma);
    const bohdan = await createOwnedApplication(database.prisma);
    await createAiResult(database.prisma, {
      userId: olena.userId,
      updatedAt: new Date('2026-10-21T23:59:00.000Z'),
    });
    await createAiResult(database.prisma, {
      userId: bohdan.userId,
      tokensIn: 1000,
      updatedAt: new Date('2026-09-30T23:59:00.000Z'),
    });

    await expect(run(await queuedJob(olena, OTHER_VACANCY))).resolves.toMatchObject({
      cached: false,
    });
    expect(ai.calls).toHaveLength(1);
  });

  it("asks services/ai again for another user's identical vacancy and counts only that user's calls", async () => {
    const olena = await createOwnedApplication(database.prisma);
    const bohdan = await createOwnedApplication(database.prisma);
    await run(await queuedJob(olena, VACANCY_TEXT));

    await expect(run(await queuedJob(bohdan, VACANCY_TEXT))).resolves.toMatchObject({
      cached: false,
    });

    expect(ai.calls).toHaveLength(2);
    const owners = await database.prisma.aiResult.findMany({ select: { userId: true } });
    expect(owners).toHaveLength(2);
    expect(owners).toEqual(
      expect.arrayContaining([{ userId: olena.userId }, { userId: bohdan.userId }]),
    );
  });

  it("skips a job sent with another user's id and leaves that user's job queued", async () => {
    const olena = await createOwnedApplication(database.prisma);
    const bohdan = await createOwnedApplication(database.prisma);
    const job = await queuedJob(olena, VACANCY_TEXT);

    await expect(run({ ...job, userId: bohdan.userId })).resolves.toBeNull();

    expect(ai.calls).toEqual([]);
    expect(await storedJob(job.aiJobId)).toMatchObject({ status: 'queued', finishedAt: null });
  });
});

describe('AiService.queuePosition on Postgres', () => {
  it("counts only the queued jobs created earlier, estimates from the kind's succeeded latencies and answers null for another user", async () => {
    const olena = await createOwnedApplication(database.prisma);
    const bohdan = await createOwnedApplication(database.prisma);
    const firstInLine = await jobInLine({ owner: olena, status: 'queued', minutesAgo: 10 });
    await jobInLine({ owner: olena, status: 'processing', minutesAgo: 9 });
    await jobInLine({ owner: bohdan, status: 'queued', minutesAgo: 8 });
    const third = await jobInLine({ owner: olena, status: 'queued', minutesAgo: 7 });
    await jobInLine({ owner: olena, status: 'queued', minutesAgo: 6 });
    await createAiResult(database.prisma, { userId: bohdan.userId, latencyMs: 12_000 });
    await createAiResult(database.prisma, { userId: olena.userId, latencyMs: 18_000 });
    await createAiResult(database.prisma, {
      userId: olena.userId,
      latencyMs: 90_000,
      status: 'failed',
    });
    await createAiResult(database.prisma, {
      userId: olena.userId,
      latencyMs: 90_000,
      kind: 'match',
    });
    const service = moduleRef.get(AiService);

    const positions = await Promise.all([
      service.queuePosition({ userId: olena.userId, aiJobId: firstInLine }),
      service.queuePosition({ userId: olena.userId, aiJobId: third }),
      service.queuePosition({ userId: bohdan.userId, aiJobId: firstInLine }),
    ]);

    expect(positions).toEqual([{ ahead: 0, etaSeconds: 15 }, { ahead: 2, etaSeconds: 30 }, null]);
  });
});
