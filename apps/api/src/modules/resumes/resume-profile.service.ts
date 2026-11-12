import { resumeParseOutputSchema } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import type { SettledAiJob } from '../ai/index.js';
import { ResumeVersionsRepository } from './resume-versions.repository.js';

@Injectable()
export class ResumeProfileService {
  constructor(private readonly versions: ResumeVersionsRepository) {}

  async settle(settled: SettledAiJob): Promise<void> {
    const { userId, resumeVersionId } = settled.job;
    if (resumeVersionId === undefined || settled.status === 'failed') {
      return;
    }
    const profile = resumeParseOutputSchema.parse(settled.output);
    await this.versions.saveProfile(userId, { id: resumeVersionId, profile });
  }
}
