import { Injectable, Logger } from '@nestjs/common';

import { AI_PAYLOAD_BUILDERS, type AiJobBuilder, AiJobQueue, AiService } from '../ai/index.js';
import { MatchRepository } from './match.repository.js';

export type MatchRequest = { applicationId: string };

@Injectable()
export class MatchQueueService {
  private readonly logger = new Logger(MatchQueueService.name);

  constructor(
    private readonly repository: MatchRepository,
    private readonly ai: AiService,
    private readonly aiQueue: AiJobQueue,
  ) {}

  async request(userId: string, { applicationId }: MatchRequest): Promise<string | null> {
    const source = await this.repository.findSource(userId, applicationId);
    if (source === null || source.isDraft) {
      return null;
    }
    const { resumeVersionId } = source;
    if (resumeVersionId === null) {
      await this.repository.clearScore(userId, applicationId);
      return null;
    }
    const profile = source.resumeVersion?.aiProfile ?? null;
    if (profile === null) {
      return null;
    }
    const input = AI_PAYLOAD_BUILDERS.match({ ...source, profile });
    const target = { applicationId, resumeVersionId };
    const aiJobId = await this.ai.createJob(userId, { kind: 'match', ...target });
    await this.queued({ aiJobId, userId, kind: 'match', buildInput: () => input, ...target });
    return aiJobId;
  }

  private async queued(job: AiJobBuilder): Promise<void> {
    await this.aiQueue.queueOrFail(job, { finalAttempt: true });
    this.logger.log({ aiJobId: job.aiJobId, applicationId: job.applicationId }, 'match queued');
  }
}
