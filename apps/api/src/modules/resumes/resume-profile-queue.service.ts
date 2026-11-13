import { AI_JOB_FAILURES, DOCUMENT_FAILURES } from '@jobflow/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue, UnrecoverableError } from 'bullmq';

import type { DomainEvent } from '../../outbox/domain-event-router.js';
import { QUEUES } from '../../queues/queues.js';
import {
  AI_PAYLOAD_BUILDERS,
  type AiCompleteJob,
  AiService,
  queueAiCompletion,
} from '../ai/index.js';
import { DocumentsError } from './documents-error.js';
import { ResumeExtractionService } from './resume-extraction.service.js';
import { type ProfileSource, ResumeVersionsRepository } from './resume-versions.repository.js';
import {
  type ResumeVersionUploadedPayload,
  resumeVersionUploadedPayloadSchema,
} from './resumes.events.js';

const DOCUMENT_REFUSALS = new Set<string>(DOCUMENT_FAILURES);

const EMPTY_FILE = 'unreadable_file' satisfies (typeof DOCUMENT_FAILURES)[number];

type ProfileRun = ResumeVersionUploadedPayload & { eventId: string; finalAttempt: boolean };

const transientTypeOf = (error: unknown) =>
  error instanceof DocumentsError ? error.type : AI_JOB_FAILURES.notReady;

@Injectable()
export class ResumeProfileQueueService {
  private readonly logger = new Logger(ResumeProfileQueueService.name);

  constructor(
    private readonly versions: ResumeVersionsRepository,
    private readonly extraction: ResumeExtractionService,
    private readonly ai: AiService,
    @InjectQueue(QUEUES.ai.name) private readonly queue: Queue,
  ) {}

  async enqueue(event: DomainEvent): Promise<void> {
    const run = this.runOf(event);
    const source = await this.versions.findForProfile(run.userId, run.resumeVersionId);
    if (source === null || source.aiProfile !== null) {
      return;
    }
    try {
      await this.extractAndQueue(run, source);
    } catch (error) {
      await this.settleFailure(run, error);
    }
  }

  private runOf({ id, payload, finalAttempt = false }: DomainEvent): ProfileRun {
    const parsed = resumeVersionUploadedPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      this.logger.error(
        { eventId: id, issues: parsed.error.issues },
        'resume upload event invalid',
      );
      throw new UnrecoverableError('resume upload event invalid');
    }
    return { ...parsed.data, eventId: id, finalAttempt };
  }

  private async extractAndQueue(run: ProfileRun, source: ProfileSource): Promise<void> {
    const { userId, resumeVersionId, aiJobId } = run;
    const extraction = await this.extraction.extract(source);
    if (extraction === null) {
      await this.fail(run, EMPTY_FILE);
      return;
    }
    const input = AI_PAYLOAD_BUILDERS.resume_parse(extraction);
    await this.versions.saveExtractedText(userId, { id: resumeVersionId, text: input.text });
    if (input.text.trim() === '' && input.pages.length === 0) {
      await this.fail(run, AI_JOB_FAILURES.needsText);
      return;
    }
    const job: AiCompleteJob = { aiJobId, userId, kind: 'resume_parse', input, resumeVersionId };
    await queueAiCompletion(this.queue, job);
    const { kind, pageCount } = extraction;
    this.logger.log({ eventId: run.eventId, aiJobId, kind, pageCount }, 'resume profile queued');
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
