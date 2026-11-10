import {
  applicationIdSchema,
  type CaptureBookmarkletInput,
  captureBookmarkletInputSchema,
  type CapturePasteInput,
  capturePasteInputSchema,
  type CapturePasteResponse,
  type CaptureRetryResponse,
} from '@jobflow/shared';
import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { Idempotent } from '../../common/idempotency/idempotent.decorator.js';
import { readRequestId } from '../../common/request-id.middleware.js';
import { RateLimit } from '../../rate-limit/rate-limit.decorator.js';
import { type AccessUser, CurrentUser, RequireScope } from '../auth/index.js';
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

  @Post('bookmarklet')
  @HttpCode(202)
  @RequireScope('capture')
  @RateLimit('capture')
  @Idempotent()
  bookmarklet(
    @CurrentUser() user: AccessUser,
    @Body({ schema: captureBookmarkletInputSchema }) input: CaptureBookmarkletInput,
    @Req() req: Request,
  ): Promise<CapturePasteResponse> {
    return this.capture.bookmarklet(user.id, { input, requestId: readRequestId(req) });
  }

  @Post('drafts/:id/confirm')
  @HttpCode(204)
  confirm(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
  ): Promise<void> {
    return this.capture.confirm(user.id, id);
  }

  @Post('drafts/:id/retry')
  @HttpCode(202)
  @RateLimit('ai')
  retry(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
    @Req() req: Request,
  ): Promise<CaptureRetryResponse> {
    return this.capture.retry(user.id, { applicationId: id, requestId: readRequestId(req) });
  }
}
