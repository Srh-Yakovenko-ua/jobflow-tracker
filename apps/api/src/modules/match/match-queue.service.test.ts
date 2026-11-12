import { getQueueToken } from '@nestjs/bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { AI_JOB_ID, FakeAiRepository, MATCH_PROFILE, VACANCY_TEXT } from '../../test/ai.js';
import { FakeMatchRepository, MATCH_SOURCE } from '../../test/match.js';
import { memoryLog } from '../../test/memory-log.js';
import { compileProcessorModule } from '../../test/processor.js';
import {
  APPLICATION_ID,
  BOHDAN_ID,
  OLENA_ID,
  RESUME_VERSION_ID,
} from '../../test/service-fixtures.js';
import { RefusingQueue, SilentQueue, StubQueue } from '../../test/stub-queues.js';
import { AiService } from '../ai/index.js';
import { MatchRepository, type MatchSource } from './match.repository.js';
import { MatchQueueService } from './match-queue.service.js';

const log = memoryLog();

const TARGET = { applicationId: APPLICATION_ID, resumeVersionId: RESUME_VERSION_ID };

async function serviceWith(queue: StubQueue = new StubQueue('ai')) {
  const repository = new FakeMatchRepository();
  const ai = new FakeAiRepository();
  const moduleRef = await compileProcessorModule(log.sink, [
    MatchQueueService,
    { provide: MatchRepository, useValue: repository },
    { provide: AiService, useValue: ai },
    { provide: getQueueToken('ai'), useValue: queue },
  ]);
  const service = moduleRef.get(MatchQueueService);
  const request = (userId = OLENA_ID) => service.request(userId, { applicationId: APPLICATION_ID });
  return { queue, repository, ai, request };
}

describe('MatchQueueService.request', () => {
  beforeEach(() => {
    log.lines.length = 0;
  });

  it('creates a match job for the application and its linked version and queues the vacancy with the profile', async () => {
    const { queue, ai, request } = await serviceWith();

    expect(await request()).toBe(AI_JOB_ID);

    expect([...ai.jobs]).toEqual([
      [AI_JOB_ID, { userId: OLENA_ID, status: 'queued', step: 1, ...TARGET }],
    ]);
    expect(queue.jobs).toEqual([
      {
        id: AI_JOB_ID,
        name: 'ai.complete',
        data: {
          aiJobId: AI_JOB_ID,
          userId: OLENA_ID,
          kind: 'match',
          input: {
            vacancy: { position: 'Senior React developer', stack: ['React'], text: VACANCY_TEXT },
            profile: MATCH_PROFILE,
          },
          ...TARGET,
        },
      },
    ]);
  });

  it('queues no job and clears a stale score when no CV is linked', async () => {
    const { queue, repository, ai, request } = await serviceWith();
    repository.source = { ...MATCH_SOURCE, resumeVersionId: null, resumeVersion: null };

    expect(await request()).toBeNull();

    expect(repository.cleared).toEqual([APPLICATION_ID]);
    expect([ai.jobs.size, queue.jobs.length]).toEqual([0, 0]);
  });

  it.each<{ case: string; userId: string; source: Partial<MatchSource> }>([
    {
      case: 'while the linked version has no AI profile yet',
      userId: OLENA_ID,
      source: { resumeVersion: { aiProfile: null } },
    },
    { case: "for another user's or a deleted application", userId: BOHDAN_ID, source: {} },
    { case: 'for a draft', userId: OLENA_ID, source: { isDraft: true } },
    {
      case: 'for a draft with no CV linked',
      userId: OLENA_ID,
      source: { isDraft: true, resumeVersionId: null, resumeVersion: null },
    },
  ])('queues no job and clears nothing $case', async ({ userId, source }) => {
    const { queue, repository, ai, request } = await serviceWith();
    repository.source = { ...MATCH_SOURCE, ...source };

    expect(await request(userId)).toBeNull();

    expect(repository.cleared).toEqual([]);
    expect([ai.jobs.size, queue.jobs.length]).toEqual([0, 0]);
  });

  it('fails the new job as not_ready and rethrows when the queue refuses it', async () => {
    const { ai, request } = await serviceWith(new RefusingQueue('ai'));

    await expect(request()).rejects.toThrow('Connection is closed.');

    expect(ai.jobs.get(AI_JOB_ID)).toEqual(
      expect.objectContaining({ status: 'failed', errorType: 'not_ready' }),
    );
  });

  it('fails the new job as not_ready after the publish limit when the queue never answers', async () => {
    const { ai, request } = await serviceWith(new SilentQueue('ai'));

    await expect(request()).rejects.toThrow('timed out after 2000 ms');

    expect(ai.jobs.get(AI_JOB_ID)).toEqual(
      expect.objectContaining({ status: 'failed', errorType: 'not_ready' }),
    );
  });
});
