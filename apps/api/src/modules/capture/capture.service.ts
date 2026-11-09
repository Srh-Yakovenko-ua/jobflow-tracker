import type { CapturePasteInput, CapturePasteResponse } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { AiService } from '../ai/index.js';
import { ApplicationDraftsService } from '../applications/index.js';
import { TimelineService } from '../events/index.js';

export type PasteCapture = { input: CapturePasteInput; requestId: string };

@Injectable()
export class CaptureService {
  constructor(
    private readonly drafts: ApplicationDraftsService,
    private readonly ai: AiService,
    private readonly timeline: TimelineService,
    private readonly prisma: PrismaService,
  ) {}

  async paste(userId: string, { input, requestId }: PasteCapture): Promise<CapturePasteResponse> {
    const possibleDuplicates = await this.drafts.possibleDuplicates(userId, input);
    const captured = await this.prisma.$transaction(async (tx) => {
      const { applicationId, createdAt } = await this.drafts.open(userId, { input, tx });
      const jobId = await this.ai.createJob(userId, { kind: 'vacancy_parse', applicationId, tx });
      await this.timeline.record(userId, {
        applicationId,
        kind: 'captured',
        payload: { method: 'paste' },
        occurredAt: createdAt,
        tx,
      });
      await this.drafts.announce(userId, { applicationId, aiJobId: jobId, requestId, tx });
      return { applicationId, jobId };
    });
    return { ...captured, possibleDuplicates };
  }
}
