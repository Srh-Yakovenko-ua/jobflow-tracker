import {
  type CaptureBookmarkletInput,
  type CaptureMethod,
  type CapturePasteInput,
  type CapturePasteResponse,
  type CaptureRetryResponse,
  VACANCY_PARSE_LIMITS,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { AiService } from '../ai/index.js';
import { ApplicationDraftsService } from '../applications/index.js';
import { TimelineService } from '../events/index.js';
import { textOfHtml } from './html-text.js';

export type PasteCapture = { input: CapturePasteInput; requestId: string };

export type BookmarkletCapture = { input: CaptureBookmarkletInput; requestId: string };

export type DraftRetryRequest = { applicationId: string; requestId: string };

type Capture = PasteCapture & { method: CaptureMethod };

function draftInputOf({ url, title, text, html }: CaptureBookmarkletInput): CapturePasteInput {
  const pageText = (html === undefined ? '' : textOfHtml(html)) || text;
  const titled = `${title}\n\n${pageText}`;
  return { url, text: titled.slice(0, VACANCY_PARSE_LIMITS.textMaxLength).toWellFormed() };
}

@Injectable()
export class CaptureService {
  constructor(
    private readonly drafts: ApplicationDraftsService,
    private readonly ai: AiService,
    private readonly timeline: TimelineService,
    private readonly prisma: PrismaService,
  ) {}

  paste(userId: string, { input, requestId }: PasteCapture): Promise<CapturePasteResponse> {
    return this.capture(userId, { input, method: 'paste', requestId });
  }

  bookmarklet(
    userId: string,
    { input, requestId }: BookmarkletCapture,
  ): Promise<CapturePasteResponse> {
    return this.capture(userId, { input: draftInputOf(input), method: 'bookmarklet', requestId });
  }

  async confirm(userId: string, applicationId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const confirmedAt = await this.drafts.confirm(userId, { applicationId, tx });
      await this.timeline.record(userId, {
        applicationId,
        kind: 'draft_confirmed',
        payload: {},
        occurredAt: confirmedAt,
        tx,
      });
    });
  }

  retry(
    userId: string,
    { applicationId, requestId }: DraftRetryRequest,
  ): Promise<CaptureRetryResponse> {
    return this.prisma.$transaction(async (tx) => {
      const runningJobId = await this.drafts.lockForRetry(userId, { applicationId, tx });
      if (runningJobId !== null) {
        return { jobId: runningJobId };
      }
      const jobId = await this.ai.createJob(userId, { kind: 'vacancy_parse', applicationId, tx });
      await this.drafts.announce(userId, { applicationId, aiJobId: jobId, requestId, tx });
      return { jobId };
    });
  }

  private async capture(
    userId: string,
    { input, method, requestId }: Capture,
  ): Promise<CapturePasteResponse> {
    const possibleDuplicates = await this.drafts.possibleDuplicates(userId, input);
    const captured = await this.prisma.$transaction(async (tx) => {
      const { applicationId, createdAt } = await this.drafts.open(userId, { input, tx });
      const jobId = await this.ai.createJob(userId, { kind: 'vacancy_parse', applicationId, tx });
      await this.timeline.record(userId, {
        applicationId,
        kind: 'captured',
        payload: { method },
        occurredAt: createdAt,
        tx,
      });
      await this.drafts.announce(userId, { applicationId, aiJobId: jobId, requestId, tx });
      return { applicationId, jobId };
    });
    return { ...captured, possibleDuplicates };
  }
}
