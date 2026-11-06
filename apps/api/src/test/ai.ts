import type { AiCompletion, AiJobStatus, AiKind } from '@jobflow/shared';
import { buildVacancyCompletion } from '@jobflow/shared/testing';

import type { AiUsageRow } from '../ai-usage/ai-usage.repository.js';
import type {
  AiCompleteCall,
  AiCompleteJob,
  AiJobChange,
  AiResultKey,
  BudgetUsage,
  BudgetWindow,
  CachedAiResult,
  FailAiJob,
  FinishAiJob,
  QueueSample,
  SaveAiResult,
} from '../modules/ai/index.js';
import { OLENA_ID } from './service-fixtures.js';

export const VACANCY_TEXT = 'Senior React developer, Acme, remote, 4000-5000 USD';

export const VACANCY_COMPLETION = buildVacancyCompletion();

export const AI_JOB_ID = '0199f0a0-0000-7000-8000-000000000201';

export const VACANCY_JOB: AiCompleteJob = {
  aiJobId: AI_JOB_ID,
  userId: OLENA_ID,
  kind: 'vacancy_parse',
  input: { text: VACANCY_TEXT },
  requestId: 'req-ai-7',
};

export const VACANCY_CALL: AiCompleteCall = {
  kind: VACANCY_JOB.kind,
  input: VACANCY_JOB.input,
  requestId: VACANCY_JOB.requestId,
};

export const NVIDIA_MODEL = 'meta/llama-3.3-70b-instruct';

export const AI_USAGE_ROWS: AiUsageRow[] = [
  {
    day: '2026-11-04',
    kind: 'vacancy_parse',
    model: 'fake',
    calls: 2,
    tokensIn: 400,
    tokensOut: 100,
    avgLatencyMs: 1500,
  },
  {
    day: '2026-11-05',
    kind: 'match',
    model: 'fake',
    calls: 1,
    tokensIn: 50,
    tokensOut: 10,
    avgLatencyMs: 500,
  },
  {
    day: '2026-11-05',
    kind: 'vacancy_parse',
    model: NVIDIA_MODEL,
    calls: 1,
    tokensIn: 20,
    tokensOut: 5,
    avgLatencyMs: 701,
  },
];

export class FakeAiClient {
  readonly calls: AiCompleteCall[] = [];

  answer: () => Promise<AiCompletion<AiKind>> = () => Promise.resolve(VACANCY_COMPLETION);

  complete(call: AiCompleteCall): Promise<AiCompletion<AiKind>> {
    this.calls.push(call);
    return this.answer();
  }
}

export type FakeAiJob = {
  userId: string;
  status: AiJobStatus;
  aiResultId?: string;
  errorType?: string;
  finishedAt?: Date;
};

export type StoredAiResult = SaveAiResult & { id: string; userId: string };

type JobMove = { id: string; from: AiJobStatus[]; to: Partial<FakeAiJob> };

type BudgetQuery = BudgetWindow & { userId: string };

const resultKey = (userId: string, { kind, inputHash }: AiResultKey) =>
  `${userId}/${kind}/${inputHash}`;

export class FakeAiRepository {
  readonly jobs = new Map<string, FakeAiJob>();

  readonly results = new Map<string, StoredAiResult>();

  readonly budgetQueries: BudgetQuery[] = [];

  usage: BudgetUsage = { calls: 0, tokens: 0 };

  queue: QueueSample = { ahead: 0, latencies: [] };

  refusal: Error | undefined;

  queueJob(userId: string, id = AI_JOB_ID): void {
    this.jobs.set(id, { userId, status: 'queued' });
  }

  startJob(userId: string, { id }: AiJobChange): Promise<number> {
    const to = { status: 'processing' } as const;
    return this.reached(() => this.moveJob(userId, { id, from: ['queued', 'processing'], to }));
  }

  finishJob(userId: string, { id, aiResultId, now }: FinishAiJob): Promise<void> {
    const to = { status: 'done', aiResultId, finishedAt: now } as const;
    return this.reached(() => {
      this.moveJob(userId, { id, from: ['processing'], to });
    });
  }

  failJob(userId: string, { id, errorType, now }: FailAiJob): Promise<void> {
    const to = { status: 'failed', errorType, finishedAt: now } as const;
    return this.reached(() => {
      this.moveJob(userId, { id, from: ['processing'], to });
    });
  }

  findCachedResult(userId: string, key: AiResultKey): Promise<CachedAiResult | null> {
    return this.reached(() => {
      const stored = this.results.get(resultKey(userId, key));
      return stored?.status === 'succeeded' ? { id: stored.id, output: stored.output } : null;
    });
  }

  saveResult(userId: string, result: SaveAiResult): Promise<string> {
    return this.reached(() => {
      const key = resultKey(userId, result);
      const id = this.results.get(key)?.id ?? `ai-result-${String(this.results.size + 1)}`;
      this.results.set(key, { ...result, id, userId });
      return id;
    });
  }

  budgetUsage(userId: string, window: BudgetWindow): Promise<BudgetUsage> {
    return this.reached(() => {
      this.budgetQueries.push({ userId, ...window });
      return this.usage;
    });
  }

  queueSample(userId: string, id: string): Promise<QueueSample | null> {
    return this.reached(() => {
      const job = this.jobs.get(id);
      return job?.userId === userId && job.status === 'queued' ? this.queue : null;
    });
  }

  private moveJob(userId: string, { id, from, to }: JobMove): number {
    const job = this.jobs.get(id);
    if (job?.userId !== userId || !from.includes(job.status)) {
      return 0;
    }
    this.jobs.set(id, { ...job, ...to });
    return 1;
  }

  private reached<T>(work: () => T): Promise<T> {
    return this.refusal === undefined ? Promise.resolve(work()) : Promise.reject(this.refusal);
  }
}
