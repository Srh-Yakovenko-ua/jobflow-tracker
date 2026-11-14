import {
  type CaptureRetryResponse,
  type Plan,
  type SummaryArchive,
  type SummaryResponse,
  summarySchema,
} from '@jobflow/shared';
import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';

import { Idempotent } from '../../common/idempotency/idempotent.decorator.js';
import { RequestId } from '../../common/request-id.decorator.js';
import { RateLimit } from '../../rate-limit/rate-limit.decorator.js';
import { type AccessUser, CurrentUser } from '../auth/index.js';
import { SummariesService } from './summaries.service.js';
import { SummaryRequestsService } from './summary-requests.service.js';

@Controller('summaries')
export class SummariesController {
  constructor(
    private readonly summaries: SummariesService,
    private readonly requests: SummaryRequestsService,
  ) {}

  @Get()
  archive(@CurrentUser() user: AccessUser): Promise<SummaryArchive> {
    return this.summaries.archive(user.id);
  }

  @Get('latest')
  latest(@CurrentUser() user: AccessUser): Promise<SummaryResponse> {
    return this.summaries.latest(user.id);
  }

  @Post()
  @HttpCode(202)
  @RateLimit('ai')
  @Idempotent()
  request(
    @CurrentUser() user: AccessUser,
    @RequestId() requestId: string,
  ): Promise<CaptureRetryResponse> {
    return this.requests.request(user.id, requestId);
  }

  @Post(':aiJobId/plan')
  @HttpCode(201)
  @Idempotent()
  saveAsPlan(
    @CurrentUser() user: AccessUser,
    @Param('aiJobId', { schema: summarySchema.shape.aiJobId }) aiJobId: string,
  ): Promise<Plan> {
    return this.summaries.saveAsPlan(user.id, aiJobId);
  }
}
