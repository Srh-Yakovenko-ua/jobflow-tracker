import type { AiCompletion, AiJobStatus, AiKind, Contact, NoteInput } from '@jobflow/shared';
import {
  buildVacancyCompletion,
  buildVacancyParseOutput,
  VACANCY_SAMPLE_TEXT,
  vacancyFieldOf,
} from '@jobflow/shared/testing';

import type { VacancyEvalCaseFile, VacancyExpected } from '../ai-eval/vacancy-cases.js';
import type { AiUsageRow } from '../ai-usage/ai-usage.repository.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  AiCompleteCall,
  AiCompleteJob,
  AiJobChange,
  AiJobRow,
  AiResultKey,
  BudgetUsage,
  BudgetWindow,
  CachedAiResult,
  CreateAiJob,
  FailAiJob,
  FinishAiJob,
  QueueSample,
  SaveAiFailure,
  SaveAiResult,
  SettledAiJob,
} from '../modules/ai/index.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OLENA_ID } from './service-fixtures.js';

export const VACANCY_TEXT = VACANCY_SAMPLE_TEXT;

export const VACANCY_COMPLETION = buildVacancyCompletion();

export const NAMELESS_VACANCY_COMPLETION = buildVacancyCompletion({
  output: buildVacancyParseOutput({
    company: vacancyFieldOf(null, null),
    position: vacancyFieldOf(null, null),
  }),
});

export const PARSED_VACANCY_COLUMNS = {
  company: 'Acme',
  position: 'Senior React developer',
  salaryMin: 4000,
  salaryMax: 5000,
  currency: 'USD',
  stack: ['React'],
  location: null,
  workMode: 'remote',
} satisfies Partial<VacancyExpected>;

export const VACANCY_EXPECTED: VacancyExpected = {
  ...PARSED_VACANCY_COLUMNS,
  seniority: 'senior',
  salaryTax: null,
  englishLevel: null,
  sourceGuess: null,
  failure: null,
};

export const VACANCY_EVAL_CASE: VacancyEvalCaseFile = {
  source: 'djinni',
  language: 'en',
  text: VACANCY_TEXT,
  expected: VACANCY_EXPECTED,
};

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

export const PRIVATE_NOTE: NoteInput = {
  body: 'Рекрутерка просила не згадувати мою поточну зарплату',
};

export const RECRUITER_CHANNELS: Pick<Contact, 'email' | 'phone' | 'telegram'> = {
  email: 'hr@acme.test',
  phone: '+380 67 123 45 67',
  telegram: '@acme_hr',
};

export const NVIDIA_MODEL = 'meta/llama-3.3-70b-instruct';

export const FAILED_AI_RESULT = {
  status: 'failed',
  output: Prisma.DbNull,
  model: '',
  tokensIn: 0,
  tokensOut: 0,
  latencyMs: 0,
} satisfies Partial<Prisma.AiResultUncheckedCreateInput>;

const AI_JOB_ROW = { status: true, errorType: true, aiResultId: true, finishedAt: true } as const;

export function storedAiJob(prisma: PrismaService, id: string) {
  return prisma.aiJob.findUniqueOrThrow({ where: { id }, select: AI_JOB_ROW });
}

export const AI_USAGE_ROWS: AiUsageRow[] = [
  {
    day: '2026-11-04',
    kind: 'vacancy_parse',
    status: 'succeeded',
    model: 'fake',
    calls: 2,
    tokensIn: 400,
    tokensOut: 100,
    avgLatencyMs: 1500,
  },
  {
    day: '2026-11-04',
    kind: 'vacancy_parse',
    status: 'failed',
    model: '',
    calls: 1,
    tokensIn: 0,
    tokensOut: 0,
    avgLatencyMs: 0,
  },
  {
    day: '2026-11-05',
    kind: 'match',
    status: 'succeeded',
    model: 'fake',
    calls: 1,
    tokensIn: 50,
    tokensOut: 10,
    avgLatencyMs: 500,
  },
  {
    day: '2026-11-05',
    kind: 'vacancy_parse',
    status: 'succeeded',
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

export class SettledAiJobs {
  readonly outcomes: SettledAiJob[] = [];

  readonly record = (outcome: SettledAiJob): Promise<void> => {
    this.outcomes.push(outcome);
    return Promise.resolve();
  };
}

export type FakeAiJob = {
  userId: string;
  status: AiJobStatus;
  step?: number;
  applicationId?: string;
  aiResultId?: string;
  errorType?: string;
  finishedAt?: Date;
};

type StoredAiResult = SaveAiResult & { id: string; userId: string };

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
    this.jobs.set(id, { userId, status: 'queued', step: 1 });
  }

  createJob(userId: string, { applicationId }: CreateAiJob): Promise<string> {
    return this.reached(() => {
      this.jobs.set(AI_JOB_ID, { userId, status: 'queued', step: 1, applicationId });
      return AI_JOB_ID;
    });
  }

  startJob(userId: string, { id }: AiJobChange): Promise<number> {
    const to = { status: 'processing', step: 2 } as const;
    return this.reached(() => this.moveJob(userId, { id, from: ['queued', 'processing'], to }));
  }

  finishJob(userId: string, { id, aiResultId, now }: FinishAiJob): Promise<void> {
    const to = { status: 'done', step: 3, aiResultId, finishedAt: now } as const;
    return this.reached(() => {
      this.moveJob(userId, { id, from: ['processing'], to });
    });
  }

  failJob(userId: string, { id, errorType, now }: FailAiJob): Promise<number> {
    const to = { status: 'failed', errorType, finishedAt: now } as const;
    return this.reached(() => this.moveJob(userId, { id, from: ['processing'], to }));
  }

  findJob(userId: string, id: string): Promise<AiJobRow | null> {
    return this.reached(() => {
      const job = this.jobs.get(id);
      if (job?.userId !== userId) {
        return null;
      }
      const { status, step = 0, errorType = null, applicationId = null } = job;
      return { id, kind: 'vacancy_parse', status, step, errorType, applicationId };
    });
  }

  findCachedResult(userId: string, key: AiResultKey): Promise<CachedAiResult | null> {
    return this.reached(() => {
      const stored = this.results.get(resultKey(userId, key));
      return stored?.status === 'succeeded' ? { id: stored.id, output: stored.output } : null;
    });
  }

  saveResult(userId: string, result: SaveAiResult): Promise<string> {
    return this.reached(() => this.store(userId, result));
  }

  saveFailure(userId: string, failure: SaveAiFailure): Promise<void> {
    return this.reached(() => {
      if (this.results.get(resultKey(userId, failure))?.status !== 'succeeded') {
        this.store(userId, { ...failure, status: 'failed' });
      }
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

  private store(userId: string, result: SaveAiResult): string {
    const key = resultKey(userId, result);
    const id = this.results.get(key)?.id ?? `ai-result-${String(this.results.size + 1)}`;
    this.results.set(key, { ...result, id, userId });
    return id;
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
