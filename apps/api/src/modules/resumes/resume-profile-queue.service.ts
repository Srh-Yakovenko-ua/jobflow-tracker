import {
  AI_JOB_FAILURES,
  type AiKindInput,
  DOCUMENT_FAILURES,
  type DocumentExtraction,
} from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';

import type { EventDelivery } from '../../outbox/domain-event-router.js';
import { AI_PAYLOAD_BUILDERS, AiJobQueue, AiService } from '../ai/index.js';
import { DocumentsError } from './documents-error.js';
import { ResumeExtractionService } from './resume-extraction.service.js';
import { type ProfileSource, ResumeVersionsRepository } from './resume-versions.repository.js';
import type { ResumeVersionUploadedPayload } from './resumes.events.js';

const DOCUMENT_REFUSALS = new Set<string>(DOCUMENT_FAILURES);

const EMPTY_FILE = 'unreadable_file' satisfies (typeof DOCUMENT_FAILURES)[number];

type ProfileRun = ResumeVersionUploadedPayload & EventDelivery;

type ExtractedProfile = Pick<DocumentExtraction, 'kind' | 'pageCount'> & {
  input: AiKindInput<'resume_parse'>;
};

const transientTypeOf = (error: unknown) =>
  error instanceof DocumentsError ? error.type : AI_JOB_FAILURES.notReady;

@Injectable()
export class ResumeProfileQueueService {
  private readonly logger = new Logger(ResumeProfileQueueService.name);

  constructor(
    private readonly versions: ResumeVersionsRepository,
    private readonly extraction: ResumeExtractionService,
    private readonly ai: AiService,
    private readonly aiQueue: AiJobQueue,
  ) {}

  async enqueue(uploaded: ResumeVersionUploadedPayload, delivery: EventDelivery): Promise<void> {
    const run: ProfileRun = { ...uploaded, ...delivery };
    const source = await this.versions.findForProfile(run.userId, run.resumeVersionId);
    if (source === null || source.aiProfile !== null) {
      return;
    }
    const extracted = await this.extractedOrSettled(run, source);
    if (extracted === null) {
      return;
    }
    const { aiJobId, userId, resumeVersionId } = uploaded;
    const { input, kind, pageCount } = extracted;
    const job = { aiJobId, userId, kind: 'resume_parse', resumeVersionId } as const;
    await this.aiQueue.queueOrFail({ ...job, buildInput: () => input }, delivery);
    this.logger.log({ eventId: run.eventId, aiJobId, kind, pageCount }, 'resume profile queued');
  }

  private async extractedOrSettled(
    run: ProfileRun,
    source: ProfileSource,
  ): Promise<ExtractedProfile | null> {
    try {
      return await this.extracted(run, source);
    } catch (error) {
      await this.settleFailure(run, error);
      return null;
    }
  }

  private async extracted(
    run: ProfileRun,
    source: ProfileSource,
  ): Promise<ExtractedProfile | null> {
    const extraction = await this.extraction.extract(source);
    if (extraction === null) {
      await this.fail(run, EMPTY_FILE);
      return null;
    }
    const input = AI_PAYLOAD_BUILDERS.resume_parse(extraction);
    await this.versions.saveExtractedText(run.userId, {
      id: run.resumeVersionId,
      text: input.text,
    });
    if (input.text.trim() === '' && input.pages.length === 0) {
      await this.fail(run, AI_JOB_FAILURES.needsText);
      return null;
    }
    return { input, kind: extraction.kind, pageCount: extraction.pageCount };
  }

  private async settleFailure(run: ProfileRun, error: unknown): Promise<void> {
    if (error instanceof DocumentsError && DOCUMENT_REFUSALS.has(error.type)) {
      await this.fail(run, AI_JOB_FAILURES.needsText);
      return;
    }
    if (run.finalAttempt) {
      await this.fail(run, transientTypeOf(error));
    }
    throw error;
  }

  private async fail(run: ProfileRun, errorType: string): Promise<void> {
    await this.ai.failJob(run.userId, { id: run.aiJobId, errorType });
    this.logger.warn(
      { eventId: run.eventId, aiJobId: run.aiJobId, errorType },
      'resume profile failed',
    );
  }
}
