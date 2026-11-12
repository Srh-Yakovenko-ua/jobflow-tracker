import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AI_JOB_ID, RESUME_PROFILE } from '../../test/ai.js';
import { FakeProfileVersions } from '../../test/resumes.js';
import { BOHDAN_ID, OLENA_ID, RESUME_VERSION_ID } from '../../test/service-fixtures.js';
import type { AiCompleteJob, SettledAiJob } from '../ai/index.js';
import { ResumeProfileService } from './resume-profile.service.js';
import { ResumeVersionsRepository } from './resume-versions.repository.js';

const JOB: AiCompleteJob = {
  aiJobId: AI_JOB_ID,
  userId: OLENA_ID,
  kind: 'resume_parse',
  input: { text: 'React', pages: [] },
  resumeVersionId: RESUME_VERSION_ID,
};

const doneFor = (job: AiCompleteJob, output: unknown = RESUME_PROFILE): SettledAiJob => ({
  job,
  status: 'done',
  output,
});

async function serviceWith() {
  const versions = new FakeProfileVersions();
  const moduleRef = await Test.createTestingModule({
    providers: [ResumeProfileService, { provide: ResumeVersionsRepository, useValue: versions }],
  }).compile();
  return { versions, service: moduleRef.get(ResumeProfileService) };
}

describe('ResumeProfileService.settle', () => {
  it('stores the parsed profile on the version the job was queued for', async () => {
    const { versions, service } = await serviceWith();

    await service.settle(doneFor(JOB));

    expect(versions.profiles).toEqual([{ id: RESUME_VERSION_ID, profile: RESUME_PROFILE }]);
  });

  it.each([
    { job: 'that failed', settled: { job: JOB, status: 'failed', errorType: 'needs_text' } },
    { job: 'without a resume version', settled: doneFor({ ...JOB, resumeVersionId: undefined }) },
    { job: "of another user's version", settled: doneFor({ ...JOB, userId: BOHDAN_ID }) },
  ] satisfies { job: string; settled: SettledAiJob }[])(
    'stores nothing for a job $job',
    async ({ settled }) => {
      const { versions, service } = await serviceWith();

      await service.settle(settled);

      expect(versions.profiles).toEqual([]);
    },
  );

  it('refuses an output that is no resume profile and stores nothing', async () => {
    const { versions, service } = await serviceWith();

    await expect(service.settle(doneFor(JOB, { skills: 'React' }))).rejects.toThrow();

    expect(versions.profiles).toEqual([]);
  });
});
