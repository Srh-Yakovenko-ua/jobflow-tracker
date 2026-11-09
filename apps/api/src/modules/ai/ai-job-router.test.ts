import { describe, expect, it } from 'vitest';

import { SettledAiJobs, VACANCY_COMPLETION, VACANCY_JOB } from '../../test/ai.js';
import { AiJobRouter, type SettledAiJob } from './ai-job-router.js';

const DONE: SettledAiJob = {
  job: VACANCY_JOB,
  status: 'done',
  output: VACANCY_COMPLETION.output,
};

const FAILED: SettledAiJob = { job: VACANCY_JOB, status: 'failed', errorType: 'budget_exceeded' };

describe('AiJobRouter', () => {
  it('hands a settled vacancy_parse job to every subscriber of that kind, done and failed alike', async () => {
    const router = new AiJobRouter();
    const [first, second] = [new SettledAiJobs(), new SettledAiJobs()];
    router.subscribe('vacancy_parse', first.record);
    router.subscribe('vacancy_parse', second.record);

    await router.route(DONE);
    await router.route(FAILED);

    expect(first.outcomes).toEqual([DONE, FAILED]);
    expect(second.outcomes).toEqual([DONE, FAILED]);
  });

  it('settles a job of a kind nobody subscribes to without an error', async () => {
    await expect(new AiJobRouter().route(DONE)).resolves.toBeUndefined();
  });

  it('rejects when a subscriber throws and calls no later subscriber, so the attempt is retried', async () => {
    const router = new AiJobRouter();
    const later = new SettledAiJobs();
    const refused = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    router.subscribe('vacancy_parse', () => Promise.reject(refused));
    router.subscribe('vacancy_parse', later.record);

    await expect(router.route(DONE)).rejects.toBe(refused);

    expect(later.outcomes).toEqual([]);
  });
});
