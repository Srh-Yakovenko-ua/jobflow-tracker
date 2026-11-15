import {
  type ApplicationMatchResponse,
  type CaptureRetryResponse,
  cvHintsInputSchema,
  cvHintsOutputSchema,
  type CvHintsResponse,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { conflict } from '../../common/app-error.js';
import { owned } from '../../common/owned.js';
import { toValidationError } from '../../common/validation.js';
import type { InTransaction } from '../../prisma/in-transaction.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AI_PAYLOAD_BUILDERS, aiResultResponse, AiService } from '../ai/index.js';
import { MatchService } from '../match/index.js';
import type { CvHintsRequested } from './cv-hints.events.js';
import { CvHintsRepository } from './cv-hints.repository.js';

export type CvHintsGeneration = { applicationId: string; requestId: string };

type ScoredMatch = NonNullable<ApplicationMatchResponse['match']>;

type ScoredSource = { applicationId: string; match: ScoredMatch };

type PendingRequest = Required<InTransaction> & { requested: Omit<CvHintsRequested, 'aiJobId'> };

const NO_SCORE = 'CV hints need a Match Score of the application';

const NO_PROFILE = 'CV hints need the skills profile of the linked CV version';

@Injectable()
export class CvHintsService {
  constructor(
    private readonly repository: CvHintsRepository,
    private readonly match: MatchService,
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
  ) {}

  async read(userId: string, applicationId: string): Promise<CvHintsResponse> {
    const { match } = await this.match.read(userId, applicationId);
    if (match === null) {
      return { result: null, job: null };
    }
    const latest = await this.repository.findLatest(userId, {
      applicationId,
      resumeVersionId: match.resumeVersion.id,
      since: new Date(match.computedAt),
    });
    return aiResultResponse(latest ?? undefined, cvHintsOutputSchema);
  }

  async request(
    userId: string,
    { applicationId, requestId }: CvHintsGeneration,
  ): Promise<CaptureRetryResponse> {
    const { match } = await this.match.read(userId, applicationId);
    if (match === null) {
      throw conflict(NO_SCORE);
    }
    const input = await this.inputOf(userId, { applicationId, match });
    const resumeVersionId = match.resumeVersion.id;
    const requested = { applicationId, resumeVersionId, requestId, input };
    return this.prisma.$transaction(async (tx) => {
      const locked = owned(await this.repository.lockApplication(userId, { applicationId, tx }));
      const jobId = locked.runningJobId ?? (await this.created(userId, { requested, tx }));
      return { jobId };
    });
  }

  private async inputOf(userId: string, { applicationId, match }: ScoredSource) {
    const source = owned(await this.repository.findProfile(userId, applicationId));
    const linked = source.resumeVersionId === match.resumeVersion.id;
    const profile = linked ? (source.resumeVersion?.aiProfile ?? null) : null;
    if (profile === null) {
      throw conflict(NO_PROFILE);
    }
    const parsed = cvHintsInputSchema.safeParse(
      AI_PAYLOAD_BUILDERS.cv_hints({ position: source.position, profile, breakdown: match }),
    );
    if (!parsed.success) {
      throw toValidationError(parsed.error.issues);
    }
    return parsed.data;
  }

  private async created(userId: string, { requested, tx }: PendingRequest): Promise<string> {
    const { applicationId, resumeVersionId } = requested;
    const aiJobId = await this.ai.createJob(userId, {
      kind: 'cv_hints',
      applicationId,
      resumeVersionId,
      tx,
    });
    await this.repository.recordRequested(userId, { requested: { ...requested, aiJobId }, tx });
    return aiJobId;
  }
}
