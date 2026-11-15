import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { describe, expect, it } from 'vitest';

import { QUEUES } from '../../queues/queues.js';
import { FakeAiClient, storedAiJob, VACANCY_TEXT } from '../../test/ai.js';
import { useTestDatabase } from '../../test/database.js';
import { createAiJob, createUser } from '../../test/factories.js';
import { memoryLog } from '../../test/memory-log.js';
import { recordSpans } from '../../test/tracing.js';
import { useTestWorkers } from '../../test/worker.js';
import { AI_JOBS, type AiCompleteJob } from './ai.jobs.js';
import { AiClient } from './ai-client.js';

const log = memoryLog();

const database = useTestDatabase();

describe('AiProcessor inside a traced worker', () => {
  const spans = recordSpans();
  const workers = useTestWorkers(log.sink, (builder) =>
    builder.overrideProvider(AiClient).useValue(new FakeAiClient()),
  );

  async function queuedJob(): Promise<AiCompleteJob> {
    const { id: userId } = await createUser(database.prisma);
    const aiJobId = await createAiJob(database.prisma, { userId, status: 'queued' });
    return { aiJobId, userId, kind: 'vacancy_parse', input: { text: VACANCY_TEXT } };
  }

  it('ends the process ai span with a job completed event that carries no model output', async () => {
    const job = await queuedJob();
    const worker = await workers.compile();
    await worker.init();

    await worker.get<Queue>(getQueueToken(QUEUES.ai.name)).add(AI_JOBS.complete, job);

    await expect.poll(() => spans.named('process ai')).toHaveLength(1);
    const [processSpan] = await spans.named('process ai');
    const completed = processSpan?.events.find(({ name }) => name === 'job completed');
    const result = completed?.attributes?.['bullmq.job.result'];
    const { aiResultId } = await storedAiJob(database.prisma, job.aiJobId);
    expect(JSON.parse(String(result))).toEqual({ aiResultId, cached: false });
  });
});
