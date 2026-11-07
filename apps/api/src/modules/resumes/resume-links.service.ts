import { Injectable } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { APPLICATION_NOT_FOUND, changedOrNotFound, owned } from '../../common/owned.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TimelineService } from '../events/index.js';
import { RESUME_VERSION_NOT_FOUND } from './resume-version-response.js';
import { ResumeVersionsRepository } from './resume-versions.repository.js';
import { RESUME_EVENTS } from './resumes.events.js';

export type ResumeRelink = { applicationId: string; resumeVersionId: string };

@Injectable()
export class ResumeLinksService {
  constructor(
    private readonly repository: ResumeVersionsRepository,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly timeline: TimelineService,
  ) {}

  async relink(userId: string, { applicationId, resumeVersionId }: ResumeRelink): Promise<void> {
    const occurredAt = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const label = owned(
        await this.repository.findVersionLabel(userId, { id: resumeVersionId, tx }),
        RESUME_VERSION_NOT_FOUND,
      );
      const link = owned(await this.repository.findApplicationLink(userId, { applicationId, tx }));
      if (link.resumeVersionId === resumeVersionId) {
        return;
      }
      changedOrNotFound(
        await this.repository.relinkApplication(userId, { applicationId, resumeVersionId, tx }),
        APPLICATION_NOT_FOUND,
      );
      await this.timeline.record(userId, {
        applicationId,
        kind: 'resume_attached',
        payload: { resumeVersionId, ...label },
        occurredAt,
        tx,
      });
      await this.repository.recordEvent(userId, {
        event: { eventType: RESUME_EVENTS.attached, applicationId, resumeVersionId },
        tx,
      });
    });
  }
}
