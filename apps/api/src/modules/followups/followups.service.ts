import {
  type CaptureRetryResponse,
  followupOutputSchema,
  type FollowupRequest,
  type FollowupResponse,
  isActiveStage,
  wholeDaysBetween,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { conflict } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { owned } from '../../common/owned.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { timeZoneOf } from '../../prisma/user-time-zone.js';
import { AI_PAYLOAD_BUILDERS, AiService, type FollowupSource } from '../ai/index.js';
import {
  type FollowupSourceRow,
  FollowupsRepository,
  type LatestFollowupDraft,
} from './followups.repository.js';
import { vacancyLanguageOf } from './vacancy-language.js';

export type FollowupGeneration = {
  applicationId: string;
  request: FollowupRequest;
  requestId: string;
};

type SourceContext = Pick<FollowupSource, 'request' | 'now'>;

const NOT_ACTIVE = 'A follow-up is drafted only for an application in an active stage';

function followupSourceOf(row: FollowupSourceRow, context: SourceContext): FollowupSource {
  const { contacts, scheduledEvents, user, ...application } = row;
  return {
    application,
    recruiterName: contacts[0]?.name ?? null,
    lastInterview: scheduledEvents[0] ?? null,
    senderName: user.displayName,
    timezone: timeZoneOf(user.settings),
    ...context,
  };
}

function draftOf({ finishedAt, aiResult }: LatestFollowupDraft): FollowupResponse['draft'] {
  if (finishedAt === null || aiResult === null) {
    return null;
  }
  const { subject, body } = followupOutputSchema.parse(aiResult.output);
  return { subject, body, generatedAt: finishedAt.toISOString() };
}

@Injectable()
export class FollowupsService {
  constructor(
    private readonly repository: FollowupsRepository,
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async read(userId: string, applicationId: string): Promise<FollowupResponse> {
    const now = this.clock.now();
    const source = owned(await this.repository.findSource(userId, { applicationId, now }));
    const [draft, job] = await Promise.all([
      this.repository.findLatestDraft(userId, applicationId),
      this.repository.findLatestJob(userId, applicationId),
    ]);
    return {
      draft: draft === null ? null : draftOf(draft),
      job,
      language: vacancyLanguageOf(source.rawText ?? source.position),
      silenceDays: wholeDaysBetween(source.lastEventAt, now),
    };
  }

  async request(
    userId: string,
    { applicationId, request, requestId }: FollowupGeneration,
  ): Promise<CaptureRetryResponse> {
    const now = this.clock.now();
    const row = owned(await this.repository.findSource(userId, { applicationId, now }));
    if (row.isDraft || !isActiveStage(row.currentStage)) {
      throw conflict(NOT_ACTIVE);
    }
    const input = AI_PAYLOAD_BUILDERS.followup(followupSourceOf(row, { request, now }));
    const fresh = request.variant ? { fresh: true as const } : {};
    return this.prisma.$transaction(async (tx) => {
      const locked = owned(await this.repository.lockApplication(userId, { applicationId, tx }));
      if (locked.runningJobId !== null) {
        return { jobId: locked.runningJobId };
      }
      const aiJobId = await this.ai.createJob(userId, { kind: 'followup', applicationId, tx });
      const requested = { applicationId, aiJobId, requestId, input, ...fresh };
      await this.repository.recordRequested(userId, { requested, tx });
      return { jobId: aiJobId };
    });
  }
}
