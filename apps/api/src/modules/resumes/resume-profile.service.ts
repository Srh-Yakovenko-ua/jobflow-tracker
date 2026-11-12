import { resumeParseOutputSchema } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { SettledAiJob } from '../ai/index.js';
import { ResumeVersionsRepository } from './resume-versions.repository.js';
import { RESUME_EVENTS } from './resumes.events.js';

@Injectable()
export class ResumeProfileService {
  constructor(
    private readonly versions: ResumeVersionsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async settle(settled: SettledAiJob): Promise<void> {
    const { userId, resumeVersionId } = settled.job;
    if (resumeVersionId === undefined || settled.status === 'failed') {
      return;
    }
    const profile = resumeParseOutputSchema.parse(settled.output);
    await this.prisma.$transaction(async (tx) => {
      const count = await this.versions.saveProfile(userId, { id: resumeVersionId, profile, tx });
      if (count === 0) {
        return;
      }
      await this.versions.recordEvent(userId, {
        event: { eventType: RESUME_EVENTS.versionProfiled, resumeVersionId },
        tx,
      });
    });
  }
}
