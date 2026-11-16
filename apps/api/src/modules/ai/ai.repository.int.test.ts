import { describe, expect, it } from 'vitest';

import {
  FAILED_AI_RESULT,
  storedAiJob,
  storedFailureSettledAt,
  VACANCY_COMPLETION,
} from '../../test/ai.js';
import { useTestDatabase } from '../../test/database.js';
import {
  createAiCall,
  createAiJob,
  createAiResult,
  createOwnedApplication,
  createUser,
  type NewAiResult,
  type OwnedApplication,
} from '../../test/factories.js';
import { daysBefore, minutesBefore, NOW } from '../../test/time.js';
import { AiRepository } from './ai.repository.js';
import { budgetWindow } from './ai-budget.js';
import type { AiCallRecord } from './ai-call-row.js';
import { FAILED_CALL } from './ai-failures.js';
import type { SaveAiFailure, SaveAiResult } from './ai-result-row.js';
import { AI_SERVICE_ERRORS } from './ai-service-error.js';

type JobTarget = { userId: string; id: string; aiResultId: string };

type FailedJob = { errorType: string; finishedAt?: Date };

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

const database = useTestDatabase();

const aiRepository = () => new AiRepository(database.prisma);

const succeededResult = ({ userId }: OwnedApplication) =>
  createAiResult(database.prisma, { userId, updatedAt: EARLIER_TODAY });

const failedJob =
  ({ errorType, finishedAt = EARLIER_TODAY }: FailedJob) =>
  ({ userId, applicationId }: OwnedApplication) =>
    createAiJob(database.prisma, {
      userId,
      applicationId,
      status: 'failed',
      errorType,
      finishedAt,
    });

const failedCall =
  ({ errorType, finishedAt = EARLIER_TODAY }: FailedJob) =>
  ({ userId }: OwnedApplication) =>
    createAiCall(database.prisma, {
      userId,
      ...FAILED_CALL,
      status: 'failed',
      errorType,
      createdAt: finishedAt,
    });

const succeededCall = ({ userId }: OwnedApplication) =>
  createAiCall(database.prisma, { userId, createdAt: EARLIER_TODAY });

const othersFailedCall = async () =>
  failedCall({ errorType: 'ai_timeout' })(await createOwnedApplication(database.prisma));

const SUCCEEDED_CALL: AiCallRecord = { ...SUCCESS, errorType: null };

async function failedAttempt(userId: string, errorType: string): Promise<void> {
  const repository = aiRepository();
  await repository.recordCall(userId, { ...FAILURE, status: 'failed', errorType });
  await repository.saveFailure(userId, { ...FAILURE, error: errorType });
}

async function succeededAttempt(userId: string, now = NOW): Promise<void> {
  const repository = aiRepository();
  await repository.recordCall(userId, { ...SUCCEEDED_CALL, now });
  await repository.saveResult(userId, { ...SUCCESS, now });
}

const COUNTED_TYPES = ['ai_invalid_output', 'ai_timeout'];

const UNCOUNTED_TYPES = [
  'not_ready',
  'unauthorized',
  'validation_error',
  'rate_limited',
  'ai_provider_error',
  'forbidden',
  'not_found',
  'internal_error',
  'not_implemented',
  'unexpected_response',
];

const DAILY_CALLS = [
  { verdict: 'counts', row: 'a succeeded call from today', seed: succeededCall, calls: 1 },
  ...COUNTED_TYPES.map((errorType) => ({
    verdict: 'counts',
    row: `a call failed today with ${errorType}`,
    seed: failedCall({ errorType }),
    calls: 1,
  })),
  ...UNCOUNTED_TYPES.map((errorType) => ({
    verdict: 'leaves out',
    row: `a call failed today with ${errorType}`,
    seed: failedCall({ errorType }),
    calls: 0,
  })),
  {
    verdict: 'leaves out',
    row: 'a call failed yesterday with ai_timeout',
    seed: failedCall({ errorType: 'ai_timeout', finishedAt: daysBefore(1) }),
    calls: 0,
  },
  {
    verdict: 'leaves out',
    row: "another user's call failed today with ai_timeout",
    seed: othersFailedCall,
    calls: 0,
  },
  {
    verdict: 'leaves out',
    row: 'a succeeded result from today with no recorded call',
    seed: succeededResult,
    calls: 0,
  },
  {
    verdict: 'leaves out',
    row: 'a job failed today with ai_timeout and no recorded call',
    seed: failedJob({ errorType: 'ai_timeout' }),
    calls: 0,
  },
];

function storedResults(where: { userId: string }) {
  return database.prisma.aiResult.findMany({ where, select: AI_RESULT_ROW });
}

describe('AiRepository job changes on Postgres', () => {
  it.each(GUARDED_CHANGES)(
    '$change answers 0 and leaves $job untouched',
    async ({ apply, owner, status }) => {
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
    },
  );
});

describe('AiRepository job steps and findJob on Postgres', () => {
  it('stores step 1 for a created job, 2 once started, 3 once finished, and keeps 2 on a failed job, and finishJob answers 1 for the started job', async () => {
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

describe('AiRepository failure settle marker on Postgres', () => {
  const failedFor = ({ userId, applicationId }: OwnedApplication) =>
    createAiJob(database.prisma, {
      userId,
      applicationId,
      status: 'failed',
      errorType: 'ai_timeout',
    });

  it('marks an unsettled failure settled once, after which it is no longer found', async () => {
    const owner = await createOwnedApplication(database.prisma);
    const id = await failedFor(owner);
    const repository = aiRepository();

    const found = await repository.findUnsettledFailure(owner.userId, id);
    const marks = [
      await repository.markFailureSettled(owner.userId, { id, now: NOW }),
      await repository.markFailureSettled(owner.userId, { id, now: EARLIER_TODAY }),
    ];

    expect(found).toBe('ai_timeout');
    expect(marks).toEqual([1, 0]);
    expect(await repository.findUnsettledFailure(owner.userId, id)).toBeNull();
    expect(await storedFailureSettledAt(database.prisma, id)).toEqual(NOW);
  });

  it("neither finds nor marks another user's unsettled failure", async () => {
    const owner = await createOwnedApplication(database.prisma);
    const bohdan = await createUser(database.prisma);
    const id = await failedFor(owner);
    const repository = aiRepository();

    const found = await repository.findUnsettledFailure(bohdan.id, id);
    const marked = await repository.markFailureSettled(bohdan.id, { id, now: NOW });

    expect([found, marked]).toEqual([null, 0]);
    expect(await storedFailureSettledAt(database.prisma, id)).toBeNull();
  });

  it.each(['done', 'queued'] as const)('marks nothing on a %s job', async (status) => {
    const { userId, applicationId } = await createOwnedApplication(database.prisma);
    const id = await createAiJob(database.prisma, { userId, applicationId, status });

    await expect(aiRepository().markFailureSettled(userId, { id, now: NOW })).resolves.toBe(0);
    expect(await storedFailureSettledAt(database.prisma, id)).toBeNull();
  });

  it('stores the marker with a failure given settledAt and leaves it null without', async () => {
    const { userId, applicationId } = await createOwnedApplication(database.prisma);
    const create = () =>
      createAiJob(database.prisma, { userId, applicationId, status: 'processing' });
    const [settled, unsettled] = [await create(), await create()];
    const failure = { errorType: 'needs_text', now: NOW } as const;

    await aiRepository().failJob(userId, { id: settled, ...failure, settledAt: NOW });
    await aiRepository().failJob(userId, { id: unsettled, ...failure });

    expect([
      await storedFailureSettledAt(database.prisma, settled),
      await storedFailureSettledAt(database.prisma, unsettled),
    ]).toEqual([NOW, null]);
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

describe('AiRepository.failJobWithResult on Postgres', () => {
  it('stores the failed result and fails the processing job together, answering 1', async () => {
    const { userId, applicationId } = await createOwnedApplication(database.prisma);
    const id = await createAiJob(database.prisma, { userId, applicationId, status: 'processing' });

    const failed = await aiRepository().failJobWithResult(userId, {
      result: FAILURE,
      job: { id, errorType: 'ai_invalid_output', now: NOW },
    });

    expect(failed).toBe(1);
    expect(await storedAiJob(database.prisma, id)).toMatchObject({
      status: 'failed',
      errorType: 'ai_invalid_output',
    });
    expect(await storedResults({ userId })).toEqual([
      expect.objectContaining({ status: 'failed', error: 'ai_invalid_output' }),
    ]);
  });

  it('stores no failed result when failing the job is refused', async () => {
    const { id: userId } = await createUser(database.prisma);

    await expect(
      aiRepository().failJobWithResult(userId, {
        result: FAILURE,
        job: { id: 'not-a-uuid', errorType: 'ai_invalid_output', now: NOW },
      }),
    ).rejects.toThrow();

    expect(await storedResults({ userId })).toEqual([]);
  });
});

describe('AiRepository.budgetUsage on Postgres', () => {
  it('starts the budget day and month at UTC midnight on the Kyiv clock change', () => {
    const { dayStart, monthStart } = budgetWindow(new Date('2026-10-25T01:30:00.000Z'));

    expect([dayStart.toISOString(), monthStart.toISOString()]).toEqual([
      '2026-10-25T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z',
    ]);
  });

  it('has a daily calls row for every AI service error type', () => {
    expect([...COUNTED_TYPES, ...UNCOUNTED_TYPES].sort()).toEqual(
      Object.values(AI_SERVICE_ERRORS).sort(),
    );
  });

  it.each(DAILY_CALLS)('$verdict $row in the daily calls', async ({ seed, calls }) => {
    const owner = await createOwnedApplication(database.prisma);
    await seed(owner);

    await expect(
      aiRepository().budgetUsage(owner.userId, budgetWindow(NOW)),
    ).resolves.toHaveProperty('calls', calls);
  });

  it('counts two timed-out calls of one text as two calls of the day', async () => {
    const { id: userId } = await createUser(database.prisma);

    await failedAttempt(userId, 'ai_timeout');
    await failedAttempt(userId, 'ai_timeout');

    await expect(aiRepository().budgetUsage(userId, budgetWindow(NOW))).resolves.toHaveProperty(
      'calls',
      2,
    );
  });

  it('counts an ai_invalid_output then a not_ready on the same input the same day as one call', async () => {
    const { id: userId } = await createUser(database.prisma);

    await failedAttempt(userId, 'ai_invalid_output');
    await failedAttempt(userId, 'not_ready');

    await expect(aiRepository().budgetUsage(userId, budgetWindow(NOW))).resolves.toHaveProperty(
      'calls',
      1,
    );
  });

  it("adds only this call's tokens to this month for a result that succeeded last month and succeeds again", async () => {
    const { id: userId } = await createUser(database.prisma);
    await succeededAttempt(userId, new Date('2026-09-30T12:00:00.000Z'));

    await succeededAttempt(userId);

    await expect(aiRepository().budgetUsage(userId, budgetWindow(NOW))).resolves.toEqual({
      calls: 1,
      tokens: 160,
    });
  });

  it("keeps the user's daily calls and the monthly token sum of all users after the user deletes all AI results", async () => {
    const [olena, bohdan] = [await createUser(database.prisma), await createUser(database.prisma)];
    await succeededAttempt(olena.id);
    await succeededAttempt(bohdan.id);
    await createAiCall(database.prisma, {
      userId: bohdan.id,
      tokensIn: 1000,
      createdAt: new Date('2026-09-30T23:59:00.000Z'),
    });
    const repository = aiRepository();

    const before = await repository.budgetUsage(olena.id, budgetWindow(NOW));
    await repository.deleteResults(olena.id);
    const after = await repository.budgetUsage(olena.id, budgetWindow(NOW));

    expect(before).toEqual({ calls: 1, tokens: 320 });
    expect(after).toEqual({ calls: 1, tokens: 320 });
  });
});
