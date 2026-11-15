import {
  applicationIdSchema,
  type CaptureRetryResponse,
  type CvHintsResponse,
} from '@jobflow/shared';
import { Controller, Get, Param, Post } from '@nestjs/common';

import { RequestId } from '../../common/request-id.decorator.js';
import { AcceptsAiJob } from '../../rate-limit/rate-limit.decorator.js';
import { type AccessUser, CurrentUser } from '../auth/index.js';
import { CvHintsService } from './cv-hints.service.js';

@Controller('applications')
export class CvHintsController {
  constructor(private readonly cvHints: CvHintsService) {}

  @Get(':id/cv-hints')
  read(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
  ): Promise<CvHintsResponse> {
    return this.cvHints.read(user.id, id);
  }

  @Post(':id/cv-hints')
  @AcceptsAiJob()
  request(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
    @RequestId() requestId: string,
  ): Promise<CaptureRetryResponse> {
    return this.cvHints.request(user.id, { applicationId: id, requestId });
  }
}
