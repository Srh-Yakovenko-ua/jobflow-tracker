import { type VacancyParseOutput, vacancyParseOutputSchema } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { differenceInSeconds } from 'date-fns';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { SettledAiJob } from '../ai/index.js';
import { ApplicationDraftsService, type FilledDraft } from '../applications/index.js';
import { TimelineService } from '../events/index.js';
import { NotesService } from '../notes/index.js';

type ParsedDraft = { applicationId: string; output: VacancyParseOutput };

const durationSecOf = ({ createdAt, filledAt }: FilledDraft) =>
  Math.max(1, differenceInSeconds(filledAt, createdAt, { roundingMethod: 'round' }));

@Injectable()
export class CaptureParseService {
  constructor(
    private readonly drafts: ApplicationDraftsService,
    private readonly timeline: TimelineService,
    private readonly notes: NotesService,
    private readonly prisma: PrismaService,
  ) {}

  async settle(settled: SettledAiJob): Promise<void> {
    const { userId, applicationId } = settled.job;
    if (applicationId === undefined) {
      return;
    }
    if (settled.status === 'failed') {
      await this.keepText(userId, applicationId);
      return;
    }
    const output = vacancyParseOutputSchema.parse(settled.output);
    await this.fill(userId, { applicationId, output });
  }

  private async fill(userId: string, draft: ParsedDraft): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const filled = await this.drafts.fill(userId, { ...draft, tx });
      if (filled === null) {
        return;
      }
      await this.timeline.record(userId, {
        applicationId: draft.applicationId,
        kind: 'ai_parsed',
        payload: { durationSec: durationSecOf(filled) },
        occurredAt: filled.filledAt,
        tx,
      });
    });
  }

  private async keepText(userId: string, applicationId: string): Promise<void> {
    const body = await this.drafts.findRawText(userId, applicationId);
    if (body === null) {
      return;
    }
    const { items } = await this.notes.list(userId, applicationId);
    if (!items.some((note) => note.body === body)) {
      await this.notes.create(userId, { applicationId, input: { body } });
    }
  }
}
