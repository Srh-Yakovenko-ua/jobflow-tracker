import {
  type AiJobAccepted,
  applicationIdSchema,
  type InterviewPrepResponse,
} from '@jobflow/shared';
import { Controller, Get, Param, Post } from '@nestjs/common';

import { RequestId } from '../../common/request-id.decorator.js';
import { AcceptsAiJob } from '../../rate-limit/rate-limit.decorator.js';
import { type AccessUser, CurrentUser } from '../auth/index.js';
import { InterviewPrepService } from './interview-prep.service.js';

@Controller('applications')
export class InterviewPrepController {
  constructor(private readonly interviewPrep: InterviewPrepService) {}

  @Get(':id/interview-prep')
  read(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
  ): Promise<InterviewPrepResponse> {
    return this.interviewPrep.read(user.id, id);
  }

  @Post(':id/interview-prep')
  @AcceptsAiJob()
  request(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
    @RequestId() requestId: string,
  ): Promise<AiJobAccepted> {
    return this.interviewPrep.request(user.id, { applicationId: id, requestId });
  }
}
