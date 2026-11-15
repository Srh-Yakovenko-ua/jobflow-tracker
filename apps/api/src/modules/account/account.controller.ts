import {
  type DeleteAccountInput,
  deleteAccountInputSchema,
  type ExportAccepted,
  exportAcceptedSchema,
  type ExportLink,
  type ExportRequest,
  exportRequestSchema,
} from '@jobflow/shared';
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { Idempotent } from '../../common/idempotency/idempotent.decorator.js';
import { RequestId } from '../../common/request-id.decorator.js';
import { RateLimit } from '../../rate-limit/rate-limit.decorator.js';
import { type AccessUser, clearRefreshCookie, CurrentUser } from '../auth/index.js';
import { AccountService } from './account.service.js';
import { AccountDeletionService } from './account-deletion.service.js';

@Controller('me')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly deletion: AccountDeletionService,
  ) {}

  @Delete()
  @HttpCode(204)
  @RateLimit('login')
  async delete(
    @CurrentUser() user: AccessUser,
    @Body({ schema: deleteAccountInputSchema }) input: DeleteAccountInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.deletion.delete(user.id, input);
    clearRefreshCookie(res);
  }

  @Post('export')
  @HttpCode(202)
  @Idempotent()
  requestExport(
    @CurrentUser() user: AccessUser,
    @Body({ schema: exportRequestSchema }) { format }: ExportRequest,
    @RequestId() requestId: string,
  ): Promise<ExportAccepted> {
    return this.account.requestExport(user.id, { format, requestId });
  }

  @Get('exports/:exportId')
  exportLink(
    @CurrentUser() user: AccessUser,
    @Param('exportId', { schema: exportAcceptedSchema.shape.exportId }) exportId: string,
  ): Promise<ExportLink> {
    return this.account.exportLink(user.id, exportId);
  }
}
