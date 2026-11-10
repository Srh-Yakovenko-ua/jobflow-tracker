import { describe, expect, it } from 'vitest';

import { FAILED_AI_RESULT, storedAiJob, VACANCY_COMPLETION } from '../../test/ai.js';
import { useTestDatabase } from '../../test/database.js';
import {
  createAiJob,
  createAiResult,
  createOwnedApplication,
  createUser,
  type NewAiResult,
} from '../../test/factories.js';
import { minutesBefore, NOW } from '../../test/time.js';
import { AiRepository, type SaveAiFailure, type SaveAiResult } from './ai.repository.js';
import { budgetWindow } from './ai-budget.js';

type JobTarget = { userId: string; id: string; aiResultId: string };

const EARLIER_TODAY = minutesBefore(60);

const RESULT_KEY = { kind: 'vacancy_parse', inputHash: 'c0ffee'.padEnd(64, '0') } as const;

const SUCCESS: SaveAiResult = {
  ...RESULT_KEY,
  status: 'succeeded',
  error: null,
  now: NOW,
  ...VACANCY_COMPLETION,
};

const FAILURE: SaveAiFailure = {
  ...RESULT_KEY,
  promptVersion: 'v1',
  error: 'ai_invalid_output',
  model: '',
  tokensIn: 0,
  tokensOut: 0,
  latencyMs: 0,
  now: NOW,
};

const AI_RESULT_ROW = {
  id: true,
  status: true,
  error: true,
  tokensIn: true,
  tokensOut: true,
  updatedAt: true,
} as const;

const JOB_CHANGES = [
  {
    change: 'finishJob',
    apply: (repository: AiRepository, { userId, id, aiResultId }: JobTarget) =>
      repository.finishJob(userId, { id, aiResultId, now: NOW }),
  },
  {
    change: 'failJob',
    apply: (repository: AiRepository, { userId, id }: JobTarget) =>
      repository.failJob(userId, { id, errorType: 'ai_timeout', now: NOW }),
  },
];

const UNTOUCHED_JOBS = [
  { job: "another user's processing job", owner: 'bohdan', status: 'processing' },
  { job: "the owner's done job", owner: 'olena', status: 'done' },
] as const;

const GUARDED_CHANGES = JOB_CHANGES.flatMap((change) =>
  UNTOUCHED_JOBS.map((target) => ({ ...change, ...target })),
);

const failure = (error: string) => ({ ...FAILED_AI_RESULT, error });

const failedResultOf = (userId: string, error: string): NewAiResult => ({
  userId,
  ...RESULT_KEY,
  ...failure(error),
  updatedAt: EARLIER_TODAY,
});

const DAILY_CALLS = [
  { verdict: 'counts', row: 'a succeeded result', fields: {}, calls: 1 },
  ...['ai_invalid_output', 'ai_timeout'].map((error) => ({
    verdict: 'counts',
    row: `a result failed with ${error}`,
    fields: failure(error),
    calls: 1,
  })),
  ...['not_ready', 'unauthorized', 'validation_error', 'rate_limited', 'ai_provider_error'].map(
    (error) => ({
      verdict: 'leaves out',
      row: `a result failed with ${error}`,
      fields: failure(error),
      calls: 0,
    }),
  ),
];

const database = useTestDatabase();

const aiRepository = () => new AiRepository(database.prisma);

function storedResults(where: { userId: string }) {
  return database.prisma.aiResult.findMany({ where, select: AI_RESULT_ROW });
}

describe('AiRepository job changes on Postgres', () => {
  it.each(GUARDED_CHANGES)('$change leaves $job untouched', async ({ apply, owner, status }) => {
    const owners = {
      olena: await createOwnedApplication(database.prisma),
      bohdan: await createOwnedApplication(database.prisma),
    };
    const { userId, applicationId } = owners[owner];
    const aiResultId = await createAiResult(database.prisma, { userId });
    const id = await createAiJob(database.prisma, { userId, applicationId, status });
    const before = await storedAiJob(database.prisma, id);

    const changed = await apply(aiRepository(), { userId: owners.olena.userId, id, aiResultId });

    expect(changed).toBe(0);
    expect(await storedAiJob(database.prisma, id)).toEqual(before);
  });
});

describe('AiRepository job steps and findJob on Postgres', () => {
  it('stores step 1 for a created job, 2 once started, 3 once finished, and keeps 2 on a failed job', async () => {
    const { userId, applicationId } = await createOwnedApplication(database.prisma);
    const aiResultId = await createAiResult(database.prisma, { userId });
    const repository = aiRepository();
    const stepOf = async (id: string) => (await repository.findJob(userId, id))?.step;
    const create = () => repository.createJob(userId, { kind: 'vacancy_parse', applicationId });

    const [finished, failed] = [await create(), await create()];
    const created = await stepOf(finished);
    await repository.startJob(userId, { id: finished, now: NOW });
    await repository.startJob(userId, { id: failed, now: NOW });
    const started = await stepOf(finished);
    const finishedRows = await repository.finishJob(userId, { id: finished, aiResultId, now: NOW });
    await repository.failJob(userId, { id: failed, errorType: 'ai_timeout', now: NOW });

    expect([created, started, await stepOf(finished), await stepOf(failed)]).toEqual([1, 2, 3, 2]);
    expect(finishedRows).toBe(1);
  });

  it("finds the owner's job with its status fields and no job for another user", async () => {
    const olena = await createOwnedApplication(database.prisma);
    const bohdan = await createUser(database.prisma);
    const { userId, applicationId } = olena;
    const id = await createAiJob(database.prisma, {
      userId,
      applicationId,
      status: 'failed',
      step: 2,
      errorType: 'budget_exceeded',
    });

    const [own, foreign] = [
      await aiRepository().findJob(userId, id),
      await aiRepository().findJob(bohdan.id, id),
    ];

    expect(own).toEqual({
      id,
      kind: 'vacancy_parse',
      status: 'failed',
      step: 2,
      errorType: 'budget_exceeded',
      applicationId,
    });
    expect(foreign).toBeNull();
  });
});

describe('AiRepository.saveResult on Postgres', () => {
  it('adds the tokens of a success to the failed result it replaces and stamps it with the passed now', async () => {
    const { id: userId } = await createUser(database.prisma);
    const failedId = await createAiResult(database.prisma, {
      ...failedResultOf(userId, 'ai_timeout'),
      tokensIn: 30,
      tokensOut: 10,
    });

    await expect(aiRepository().saveResult(userId, SUCCESS)).resolves.toBe(failedId);

    expect(await storedResults({ userId })).toEqual([
      {
        id: failedId,
        status: 'succeeded',
        error: null,
        tokensIn: 150,
        tokensOut: 50,
        updatedAt: NOW,
      },
    ]);
  });
});

describe('AiRepository.saveFailure on Postgres', () => {
  it('leaves a succeeded result of the same input untouched', async () => {
    const { id: userId } = await createUser(database.prisma);
    await createAiResult(database.prisma, { userId, ...RESULT_KEY, updatedAt: EARLIER_TODAY });
    const before = await database.prisma.aiResult.findMany();

    await aiRepository().saveFailure(userId, FAILURE);

    expect(await database.prisma.aiResult.findMany()).toEqual(before);
  });

  it('rewrites the error and the time of a failed result of the same input', async () => {
    const { id: userId } = await createUser(database.prisma);
    const failedId = await createAiResult(database.prisma, failedResultOf(userId, 'not_ready'));

    await aiRepository().saveFailure(userId, FAILURE);

    expect(await storedResults({ userId })).toEqual([
      {
        id: failedId,
        status: 'failed',
        error: 'ai_invalid_output',
        tokensIn: 0,
        tokensOut: 0,
        updatedAt: NOW,
      },
    ]);
  });

  it("stores its own failure and leaves another user's failed result of the same input alone", async () => {
    const [olena, bohdan] = [await createUser(database.prisma), await createUser(database.prisma)];
    const theirs = await createAiResult(database.prisma, failedResultOf(bohdan.id, 'not_ready'));

    await aiRepository().saveFailure(olena.id, FAILURE);

    expect(await storedResults({ userId: bohdan.id })).toEqual([
      expect.objectContaining({ id: theirs, error: 'not_ready', updatedAt: EARLIER_TODAY }),
    ]);
    expect(await storedResults({ userId: olena.id })).toEqual([
      expect.objectContaining({ status: 'failed', error: 'ai_invalid_output', updatedAt: NOW }),
    ]);
  });
});

describe('AiRepository.budgetUsage on Postgres', () => {
  it.each(DAILY_CALLS)('$verdict $row from today in the daily calls', async ({ fields, calls }) => {
    const { id: userId } = await createUser(database.prisma);
    await createAiResult(database.prisma, { userId, ...fields, updatedAt: EARLIER_TODAY });

    await expect(aiRepository().budgetUsage(userId, budgetWindow(NOW))).resolves.toHaveProperty(
      'calls',
      calls,
    );
  });
});
