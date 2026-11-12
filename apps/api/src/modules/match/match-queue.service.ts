import { AI_JOB_FAILURES } from '@jobflow/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QUEUES } from '../../queues/queues.js';
import {
  AI_PAYLOAD_BUILDERS,
  type AiCompleteJob,
  AiService,
  queueAiCompletion,
} from '../ai/index.js';
import { MatchRepository } from './match.repository.js';

export type MatchRequest = { applicationId: string };

@Injectable()
export class MatchQueueService {
  private readonly logger = new Logger(MatchQueueService.name);

  constructor(
    private readonly repository: MatchRepository,
    private readonly ai: AiService,
    @InjectQueue(QUEUES.ai.name) private readonly queue: Queue,
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
    await this.queued({ aiJobId, userId, kind: 'match', input, ...target });
    return aiJobId;
  }

  private async queued(job: AiCompleteJob): Promise<void> {
    try {
      await queueAiCompletion(this.queue, job);
    } catch (error) {
      const errorType = AI_JOB_FAILURES.notReady;
      await this.ai.failJob(job.userId, { id: job.aiJobId, errorType });
      this.logger.warn({ aiJobId: job.aiJobId, errorType }, 'match job not queued');
      throw error;
    }
    this.logger.log({ aiJobId: job.aiJobId, applicationId: job.applicationId }, 'match queued');
  }
}
