import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { MATCH_OUTPUT } from '../../test/ai.js';
import { FakeMatchRepository, MATCH_JOB } from '../../test/match.js';
import { APPLICATION_ID, RESUME_VERSION_ID } from '../../test/service-fixtures.js';
import type { SettledAiJob } from '../ai/index.js';
import { MatchRepository } from './match.repository.js';
import { MatchSettleService } from './match-settle.service.js';

async function settledWith(settled: SettledAiJob) {
  const repository = new FakeMatchRepository();
  const moduleRef = await Test.createTestingModule({
    providers: [MatchSettleService, { provide: MatchRepository, useValue: repository }],
  }).compile();
  await moduleRef.get(MatchSettleService).settle(settled);
  return repository;
}

describe('MatchSettleService.settle', () => {
  it('writes the score computed from the mapping for the version the job was queued for', async () => {
    const repository = await settledWith({ job: MATCH_JOB, status: 'done', output: MATCH_OUTPUT });

    expect(repository.scores).toEqual([
      { applicationId: APPLICATION_ID, resumeVersionId: RESUME_VERSION_ID, score: 59 },
    ]);
  });

  it('leaves the score alone when the match job failed', async () => {
    const repository = await settledWith({
      job: MATCH_JOB,
      status: 'failed',
      errorType: 'no_requirements',
    });

    expect(repository.scores).toEqual([]);
  });

  it('leaves the score alone for a job that names no resume version', async () => {
    const job = { ...MATCH_JOB, resumeVersionId: undefined };

    const repository = await settledWith({ job, status: 'done', output: MATCH_OUTPUT });

    expect(repository.scores).toEqual([]);
  });

  it('refuses an output that is not a match mapping', async () => {
    await expect(
      settledWith({ job: MATCH_JOB, status: 'done', output: { requirements: 'all' } }),
    ).rejects.toThrow();
  });
});
