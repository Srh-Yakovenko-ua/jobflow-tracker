import {
  type CaptureRetryResponse,
  interviewPrepOutputSchema,
  type InterviewPrepResponse,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { owned } from '../../common/owned.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { aiResultResponse, AiService } from '../ai/index.js';
import type { InterviewPrepRequested } from './interview-prep.events.js';
import { InterviewPrepRepository } from './interview-prep.repository.js';
import { InterviewPrepSources } from './interview-prep-sources.service.js';

export type InterviewPrepGeneration = { applicationId: string; requestId: string };

export type InterviewPrepSuggestion = { applicationId: string; tx: Prisma.TransactionClient };

type PendingRequest = {
  requested: Omit<InterviewPrepRequested, 'aiJobId'>;
  tx: Prisma.TransactionClient;
};

@Injectable()
export class InterviewPrepService {
  constructor(
    private readonly repository: InterviewPrepRepository,
    private readonly sources: InterviewPrepSources,
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
  ) {}

  async read(userId: string, applicationId: string): Promise<InterviewPrepResponse> {
    const { aiJobs } = owned(await this.repository.findLatest(userId, applicationId));
    return aiResultResponse(aiJobs[0], interviewPrepOutputSchema);
  }

  async request(
    userId: string,
    { applicationId, requestId }: InterviewPrepGeneration,
  ): Promise<CaptureRetryResponse> {
    const prepared = await this.sources.prepared(userId, applicationId);
    if ('refusal' in prepared) {
      throw prepared.refusal;
    }
    const requested = { applicationId, requestId, input: prepared.vacancy };
    return this.prisma.$transaction(async (tx) => ({
      jobId: owned(await this.started(userId, { requested, tx })),
    }));
  }

  async suggest(userId: string, { applicationId, tx }: InterviewPrepSuggestion): Promise<boolean> {
    const prepared = await this.sources.prepared(userId, applicationId);
    if ('refusal' in prepared) {
      return false;
    }
    const requested = { applicationId, input: prepared.vacancy };
    return (await this.started(userId, { requested, tx })) !== null;
  }

  private async started(userId: string, { requested, tx }: PendingRequest): Promise<string | null> {
    const { applicationId } = requested;
    const locked = await this.repository.lockApplication(userId, { applicationId, tx });
    if (locked === null || locked.runningJobId !== null) {
      return locked?.runningJobId ?? null;
    }
    const aiJobId = await this.ai.createJob(userId, { kind: 'interview_prep', applicationId, tx });
    await this.repository.recordRequested(userId, { requested: { ...requested, aiJobId }, tx });
    return aiJobId;
  }
}
