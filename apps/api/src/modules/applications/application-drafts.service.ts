import type { CapturePasteInput, PossibleDuplicate, VacancyParseOutput } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { DRAFT_PLACEHOLDERS, draftFieldsOf } from './application-draft-fields.js';
import {
  APPLICATION_EVENTS,
  type ApplicationCaptureRequestedPayload,
} from './applications.events.js';
import { ApplicationsRepository } from './applications.repository.js';
import { ApplicationsService } from './applications.service.js';

type InDraftTransaction = { tx: Prisma.TransactionClient };

export type OpenDraft = InDraftTransaction & { input: CapturePasteInput };

export type OpenedDraft = { applicationId: string; createdAt: Date };

export type AnnouncedCapture = InDraftTransaction &
  Omit<ApplicationCaptureRequestedPayload, 'userId'>;

export type DraftFill = InDraftTransaction & { applicationId: string; output: VacancyParseOutput };

export type FilledDraft = { createdAt: Date; filledAt: Date };

@Injectable()
export class ApplicationDraftsService {
  constructor(
    private readonly repository: ApplicationsRepository,
    private readonly applications: ApplicationsService,
    private readonly clock: Clock,
  ) {}

  possibleDuplicates(
    userId: string,
    { url }: Pick<CapturePasteInput, 'url'>,
  ): Promise<PossibleDuplicate[]> {
    return this.applications.possibleDuplicates(userId, { url });
  }

  async open(userId: string, { input, tx }: OpenDraft): Promise<OpenedDraft> {
    const { id, createdAt } = await this.applications.insertApplied(userId, {
      fields: {
        ...DRAFT_PLACEHOLDERS,
        source: 'other',
        stack: [],
        url: input.url ?? null,
        isDraft: true,
        rawText: input.text,
      },
      now: this.clock.now(),
      tx,
    });
    return { applicationId: id, createdAt };
  }

  announce(userId: string, { tx, ...capture }: AnnouncedCapture): Promise<void> {
    const event = { eventType: APPLICATION_EVENTS.captureRequested, ...capture };
    return this.repository.recordEvent(userId, { event, tx });
  }

  async findRawText(userId: string, applicationId: string): Promise<string | null> {
    const draft = await this.repository.findOwned(userId, { id: applicationId });
    return draft?.rawText ?? null;
  }

  async fill(
    userId: string,
    { applicationId, output, tx }: DraftFill,
  ): Promise<FilledDraft | null> {
    const filledAt = this.clock.now();
    const { data, isDraft } = draftFieldsOf(output);
    const createdAt = await this.repository.fillDraft(userId, {
      id: applicationId,
      data: { ...data, isDraft },
      tx,
    });
    if (createdAt === null) {
      return null;
    }
    const fields = [...Object.keys(data), ...(isDraft ? [] : ['isDraft'])];
    const event = { eventType: APPLICATION_EVENTS.updated, applicationId, fields };
    await this.repository.recordEvent(userId, { event, tx });
    return { createdAt, filledAt };
  }
}
