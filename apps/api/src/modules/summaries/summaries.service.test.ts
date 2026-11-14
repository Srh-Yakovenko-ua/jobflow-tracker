import { buildMonthlySummaryOutput, buildPlan } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { AI_JOB_ID, FakeAiRepository } from '../../test/ai.js';
import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import { BOHDAN_ID, OLENA_ID, SEARCH_ID } from '../../test/service-fixtures.js';
import { NOW, settableClock } from '../../test/time.js';
import { AiService } from '../ai/index.js';
import { type PlanFromSummary, PlansService } from '../plans/index.js';
import type {
  LatestSummaryJob,
  RecordSummaryRequested,
  SummaryJobRow,
  SummaryJobsSince,
  SummaryStart,
} from './summaries.repository.js';
import { SummariesRepository } from './summaries.repository.js';
import { SummariesService } from './summaries.service.js';
import { SummaryRequestsService } from './summary-requests.service.js';

const RUNNING_JOB_ID = '0199f0a0-0000-7000-8000-0000000000f9';

const AI_RESULT_ID = '0199f0a0-0000-7000-8000-0000000000fa';

const PLAN_ID = '0199f0a0-0000-7000-8000-0000000000fb';

const OUTPUT = buildMonthlySummaryOutput();

const KYIV = { settings: { timezone: 'Europe/Kyiv' } };

const SUMMARY_ROW: SummaryJobRow = {
  id: AI_JOB_ID,
  createdAt: new Date('2026-09-30T21:30:00.000Z'),
  finishedAt: new Date('2026-09-30T21:31:00.000Z'),
  user: KYIV,
  aiResult: { id: AI_RESULT_ID, output: OUTPUT, plans: [{ id: PLAN_ID }] },
};

type StoredSummary = SummaryJobRow & { userId: string };

class FakeSummariesRepository {
  readonly steps: unknown[][] = [];

  start: SummaryStart = { timezone: 'Europe/Kyiv', searchId: SEARCH_ID, runningJobId: null };

  jobsCreatedAt: Date[] = [];

  summaries: StoredSummary[] = [];

  latestJob: LatestSummaryJob | null = null;

  lockUser(userId: string, { tx }: { tx: unknown }): Promise<void> {
    this.steps.push(['lockUser', userId, tx]);
    return Promise.resolve();
  }

  findStart(userId: string, { tx }: { tx: unknown }): Promise<SummaryStart> {
    this.steps.push(['findStart', userId, tx]);
    return Promise.resolve(this.start);
  }

  hasJobSince(userId: string, { since }: SummaryJobsSince): Promise<boolean> {
    this.steps.push(['hasJobSince', userId, since]);
    return Promise.resolve(this.jobsCreatedAt.some((createdAt) => createdAt >= since));
  }

  recordRequested(userId: string, { requested, tx }: RecordSummaryRequested): Promise<void> {
    this.steps.push(['recordRequested', userId, requested, tx]);
    return Promise.resolve();
  }

  findLatestSummary(userId: string): Promise<SummaryJobRow | null> {
    return Promise.resolve(this.summaries.filter((row) => row.userId === userId).at(-1) ?? null);
  }

  findSummary(userId: string, aiJobId: string): Promise<SummaryJobRow | null> {
    const found = this.summaries.find((row) => row.userId === userId && row.id === aiJobId);
    return Promise.resolve(found ?? null);
  }

  findLatestJob(): Promise<LatestSummaryJob | null> {
    return Promise.resolve(this.latestJob);
  }
}

class RecordingPlans {
  readonly saved: PlanFromSummary[] = [];

  createFromSummary(_userId: string, plan: PlanFromSummary) {
    this.saved.push(plan);
    return Promise.resolve(buildPlan());
  }
}

async function summariesWithFakes() {
  const repository = new FakeSummariesRepository();
  const ai = new FakeAiRepository();
  const plans = new RecordingPlans();
  const clock = settableClock(NOW);
  const moduleRef = await fakeTransactionModule({
    providers: [
      SummariesService,
      SummaryRequestsService,
      SummariesRepository,
      { provide: AiService, useValue: ai },
      { provide: PlansService, useValue: plans },
    ],
    clock,
  })
    .overrideProvider(SummariesRepository)
    .useValue(repository)
    .compile();
  const requests = moduleRef.get(SummaryRequestsService);
  const service = moduleRef.get(SummariesService);
  return { repository, ai, plans, clock, requests, service };
}

const requestedRow = (month: string, extra: object = {}) => [
  'recordRequested',
  OLENA_ID,
  { aiJobId: AI_JOB_ID, searchId: SEARCH_ID, month, ...extra },
  FAKE_TRANSACTION,
];

describe('SummaryRequestsService.request', () => {
  it('creates the summary job of the previous month and its outbox row in one transaction under the user lock', async () => {
    const { repository, ai, requests } = await summariesWithFakes();

    await expect(requests.request(OLENA_ID, 'req-1')).resolves.toEqual({ jobId: AI_JOB_ID });

    expect(ai.jobs.get(AI_JOB_ID)).toMatchObject({ userId: OLENA_ID, status: 'queued' });
    expect(repository.steps).toEqual([
      ['lockUser', OLENA_ID, FAKE_TRANSACTION],
      ['findStart', OLENA_ID, FAKE_TRANSACTION],
      requestedRow('2026-09', { requestId: 'req-1', fresh: true }),
    ]);
  });

  it('summarizes the month that ended in the user time zone, not in UTC', async () => {
    const { repository, requests, clock } = await summariesWithFakes();
    clock.at(new Date('2026-10-31T22:30:00.000Z'));

    await requests.request(OLENA_ID, 'req-1');

    expect(repository.steps.at(-1)).toEqual(
      requestedRow('2026-10', { requestId: 'req-1', fresh: true }),
    );
  });

  it('answers the running summary job and creates no second one', async () => {
    const { repository, ai, requests } = await summariesWithFakes();
    repository.start = { ...repository.start, runningJobId: RUNNING_JOB_ID };

    await expect(requests.request(OLENA_ID, 'req-1')).resolves.toEqual({ jobId: RUNNING_JOB_ID });

    expect(ai.jobs.size).toBe(0);
    expect(repository.steps.map(([step]) => step)).toEqual(['lockUser', 'findStart']);
  });

  it('refuses with 409 without an active search and writes nothing', async () => {
    const { repository, ai, requests } = await summariesWithFakes();
    repository.start = { ...repository.start, searchId: null };

    await expect(requests.request(OLENA_ID, 'req-1')).rejects.toMatchObject({
      body: { status: 409, detail: 'No active search' },
    });
    expect(ai.jobs.size).toBe(0);
    expect(repository.steps.map(([step]) => step)).toEqual(['lockUser', 'findStart']);
  });
});

describe('SummaryRequestsService.requestScheduledFor', () => {
  it('requests the summary of the previous month once per local month, without fresh', async () => {
    const { repository, requests } = await summariesWithFakes();
    repository.jobsCreatedAt = [new Date('2026-09-30T20:59:59.000Z')];

    await expect(requests.requestScheduledFor([OLENA_ID])).resolves.toEqual({
      picked: 1,
      requested: 1,
    });

    expect(repository.steps).toEqual([
      ['lockUser', OLENA_ID, FAKE_TRANSACTION],
      ['findStart', OLENA_ID, FAKE_TRANSACTION],
      ['hasJobSince', OLENA_ID, new Date('2026-09-30T21:00:00.000Z')],
      requestedRow('2026-09'),
    ]);
  });

  it('skips a user whose summary job was created this local month', async () => {
    const { repository, ai, requests } = await summariesWithFakes();
    repository.jobsCreatedAt = [new Date('2026-09-30T21:00:00.000Z')];

    await expect(requests.requestScheduledFor([OLENA_ID])).resolves.toEqual({
      picked: 1,
      requested: 0,
    });

    expect(ai.jobs.size).toBe(0);
  });

  it('skips a user without an active search', async () => {
    const { repository, ai, requests } = await summariesWithFakes();
    repository.start = { ...repository.start, searchId: null };

    await expect(requests.requestScheduledFor([OLENA_ID])).resolves.toEqual({
      picked: 1,
      requested: 0,
    });

    expect(ai.jobs.size).toBe(0);
  });

  it('counts every picked user and each one whose summary it requested', async () => {
    const { repository, requests } = await summariesWithFakes();

    await expect(requests.requestScheduledFor([OLENA_ID, BOHDAN_ID])).resolves.toEqual({
      picked: 2,
      requested: 2,
    });
    const requested = repository.steps.filter(([step]) => step === 'recordRequested');
    expect(requested.map(([, userId]) => userId)).toEqual([OLENA_ID, BOHDAN_ID]);
  });
});

describe('SummariesService.latest', () => {
  it('answers no summary and no job before the first one', async () => {
    const { service } = await summariesWithFakes();

    await expect(service.latest(OLENA_ID)).resolves.toEqual({ summary: null, job: null });
  });

  it('answers the latest done summary for the month before its local creation month, with its plan', async () => {
    const { repository, service } = await summariesWithFakes();
    repository.summaries = [{ ...SUMMARY_ROW, userId: OLENA_ID }];
    repository.latestJob = { id: RUNNING_JOB_ID, status: 'processing' };

    await expect(service.latest(OLENA_ID)).resolves.toEqual({
      summary: {
        aiJobId: AI_JOB_ID,
        month: '2026-09',
        text: OUTPUT.summary,
        actions: OUTPUT.actions,
        generatedAt: '2026-09-30T21:31:00.000Z',
        planId: PLAN_ID,
      },
      job: { id: RUNNING_JOB_ID, status: 'processing' },
    });
  });
});

describe('SummariesService.saveAsPlan', () => {
  it('saves the actions as the plan of the local month the summary was made in', async () => {
    const { repository, plans, service } = await summariesWithFakes();
    repository.summaries = [{ ...SUMMARY_ROW, userId: OLENA_ID }];

    await service.saveAsPlan(OLENA_ID, AI_JOB_ID);

    expect(plans.saved).toEqual([
      { aiResultId: AI_RESULT_ID, month: '2026-10', actions: OUTPUT.actions },
    ]);
  });

  it("answers 404 to another user's summary and saves no plan", async () => {
    const { repository, plans, service } = await summariesWithFakes();
    repository.summaries = [{ ...SUMMARY_ROW, userId: OLENA_ID }];

    await expect(service.saveAsPlan(BOHDAN_ID, AI_JOB_ID)).rejects.toMatchObject({
      body: { status: 404, detail: 'Summary not found' },
    });
    expect(plans.saved).toEqual([]);
  });
});
