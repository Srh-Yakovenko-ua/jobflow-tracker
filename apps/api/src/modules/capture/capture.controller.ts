import {
  applicationIdSchema,
  type CapturePasteInput,
  capturePasteInputSchema,
  type CapturePasteResponse,
} from '@jobflow/shared';
import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { Idempotent } from '../../common/idempotency/idempotent.decorator.js';
import { readRequestId } from '../../common/request-id.middleware.js';
import { RateLimit } from '../../rate-limit/rate-limit.decorator.js';
import { type AccessUser, CurrentUser } from '../auth/index.js';
import { CaptureService } from './capture.service.js';

@Controller('capture')
export class CaptureController {
  constructor(private readonly capture: CaptureService) {}

  @Post('paste')
  @HttpCode(202)
  @RateLimit('ai')
  @Idempotent()
  paste(
    @CurrentUser() user: AccessUser,
    @Body({ schema: capturePasteInputSchema }) input: CapturePasteInput,
    @Req() req: Request,
  ): Promise<CapturePasteResponse> {
    return this.capture.paste(user.id, { input, requestId: readRequestId(req) });
  }

  @Post('drafts/:id/confirm')
  @HttpCode(204)
  confirm(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
  ): Promise<void> {
    return this.capture.confirm(user.id, id);
  }
}
