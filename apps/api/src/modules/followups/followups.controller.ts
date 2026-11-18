import {
  applicationIdSchema,
  type CaptureRetryResponse,
  type FollowupRequest,
  followupRequestSchema,
  type FollowupResponse,
} from '@jobflow/shared';
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';

import { Idempotent } from '../../common/idempotency/idempotent.decorator.js';
import { RequestId } from '../../common/request-id.decorator.js';
import { AcceptsAiJob } from '../../rate-limit/rate-limit.decorator.js';
import { type AccessUser, CurrentUser } from '../auth/index.js';
import { FollowupSentService } from './followup-sent.service.js';
import { FollowupsService } from './followups.service.js';

@Controller('applications')
export class FollowupsController {
  constructor(
    private readonly followups: FollowupsService,
    private readonly sent: FollowupSentService,
  ) {}

  @Get(':id/followup')
  read(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
  ): Promise<FollowupResponse> {
    return this.followups.read(user.id, id);
  }

  @Post(':id/followup')
  @AcceptsAiJob()
  request(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
    @Body({ schema: followupRequestSchema }) request: FollowupRequest,
    @RequestId() requestId: string,
  ): Promise<CaptureRetryResponse> {
    const generation = { applicationId: id, request, requestId };
    return this.followups.request(user.id, generation);
  }

  @Post(':id/followup/sent')
  @HttpCode(204)
  @Idempotent({ keyRequired: true })
  markSent(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
  ): Promise<void> {
    return this.sent.markSent(user.id, id);
  }
}
