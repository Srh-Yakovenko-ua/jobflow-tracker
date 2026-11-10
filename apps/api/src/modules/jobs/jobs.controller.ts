import { type JobStatus, jobStatusSchema } from '@jobflow/shared';
import { Controller, Get, Param } from '@nestjs/common';

import { AiJobStatusService } from '../ai/index.js';
import { type AccessUser, CurrentUser } from '../auth/index.js';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: AiJobStatusService) {}

  @Get(':id')
  find(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: jobStatusSchema.shape.id }) id: string,
  ): Promise<JobStatus> {
    return this.jobs.find(user.id, id);
  }
}
