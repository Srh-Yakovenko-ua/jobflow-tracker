import { AI_JOB_STEPS, type JobStatus } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { notFound } from '../../common/app-error.js';
import { AiRepository } from './ai.repository.js';
import { AiService } from './ai.service.js';

@Injectable()
export class AiJobStatusService {
  constructor(
    private readonly repository: AiRepository,
    private readonly ai: AiService,
  ) {}

  async find(userId: string, id: string): Promise<JobStatus> {
    const job = await this.repository.findJob(userId, id);
    if (job === null) {
      throw notFound('Job not found');
    }
    const queue =
      job.status === 'queued' ? await this.ai.queuePosition({ userId, aiJobId: id }) : null;
    return { ...job, totalSteps: AI_JOB_STEPS.total, queue };
  }
}
