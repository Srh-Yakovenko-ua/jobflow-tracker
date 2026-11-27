import {
  type AiJobAccepted,
  applicationIdSchema,
  type CaptureBookmarkletInput,
  captureBookmarkletInputSchema,
  type CapturePasteInput,
  capturePasteInputSchema,
  type CapturePasteResponse,
} from '@jobflow/shared';
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';

import { Idempotent } from '../../common/idempotency/idempotent.decorator.js';
import { RequestId } from '../../common/request-id.decorator.js';
import { AcceptsAiJob, RateLimit } from '../../rate-limit/rate-limit.decorator.js';
import { type AccessUser, CurrentUser, RequireScope } from '../auth/index.js';
import { CaptureService } from './capture.service.js';
import { CaptureConfirmService } from './capture-confirm.service.js';

@Controller('capture')
export class CaptureController {
  constructor(
    private readonly capture: CaptureService,
    private readonly draftConfirm: CaptureConfirmService,
  ) {}

  @Post('paste')
  @AcceptsAiJob()
  paste(
    @CurrentUser() user: AccessUser,
    @Body({ schema: capturePasteInputSchema }) input: CapturePasteInput,
    @RequestId() requestId: string,
  ): Promise<CapturePasteResponse> {
    return this.capture.paste(user.id, { input, requestId });
  }

  @Post('bookmarklet')
  @HttpCode(202)
  @RequireScope('capture')
  @RateLimit('capture')
  @Idempotent()
  bookmarklet(
    @CurrentUser() user: AccessUser,
    @Body({ schema: captureBookmarkletInputSchema }) input: CaptureBookmarkletInput,
    @RequestId() requestId: string,
  ): Promise<CapturePasteResponse> {
    return this.capture.bookmarklet(user.id, { input, requestId });
  }

  @Post('drafts/:id/confirm')
  @HttpCode(204)
  confirm(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
  ): Promise<void> {
    return this.draftConfirm.confirm(user.id, id);
  }

  @Post('drafts/:id/retry')
  @HttpCode(202)
  @RateLimit('ai')
  retry(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
    @RequestId() requestId: string,
  ): Promise<AiJobAccepted> {
    return this.capture.retry(user.id, { applicationId: id, requestId });
  }
}
