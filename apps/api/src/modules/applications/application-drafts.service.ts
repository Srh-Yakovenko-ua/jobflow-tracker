import type { CapturePasteInput, PossibleDuplicate, VacancyParseOutput } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { conflict } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { owned } from '../../common/owned.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { DRAFT_BLANK, draftFieldsOf, untouchedDraftFields } from './application-draft-fields.js';
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

export type DraftConfirm = InDraftTransaction & { applicationId: string };

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
        ...DRAFT_BLANK,
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
    const draft = { id: applicationId, tx };
    const { data, isDraft } = draftFieldsOf(output);
    const { aiParsed, ...parsed } = data;
    const row = await this.repository.fillDraft(userId, { ...draft, data: { aiParsed, isDraft } });
    if (row === null) {
      return null;
    }
    const { createdAt, ...current } = row;
    const untouched = untouchedDraftFields(current, parsed);
    const written = Object.keys(untouched);
    if (written.length > 0) {
      await this.repository.updateOwned(userId, { ...draft, data: untouched });
    }
    const fields = [...written, 'aiParsed', ...(isDraft ? [] : ['isDraft'])];
    const event = { eventType: APPLICATION_EVENTS.updated, applicationId, fields };
    await this.repository.recordEvent(userId, { event, tx });
    return { createdAt, filledAt };
  }

  async confirm(userId: string, { applicationId, tx }: DraftConfirm): Promise<Date> {
    const confirmedAt = this.clock.now();
    const draft = { id: applicationId, tx };
    if ((await this.repository.confirmDraft(userId, draft)) === 0) {
      const { isDraft } = owned(await this.repository.findOwned(userId, draft));
      throw conflict(isDraft ? 'Vacancy parse is still running' : 'Application is not a draft');
    }
    const event = { eventType: APPLICATION_EVENTS.updated, applicationId, fields: ['isDraft'] };
    await this.repository.recordEvent(userId, { event, tx });
    return confirmedAt;
  }
}
