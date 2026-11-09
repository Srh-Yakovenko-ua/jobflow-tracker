import {
  type CaptureTokenCreated,
  captureTokenIdSchema,
  type CaptureTokenListResponse,
} from '@jobflow/shared';
import { Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';

import type { AccessUser } from './access-tokens.js';
import { CaptureTokensService } from './capture-tokens.service.js';
import { CurrentUser } from './current-user.decorator.js';

@Controller('capture/tokens')
export class CaptureTokensController {
  constructor(private readonly tokens: CaptureTokensService) {}

  @Get()
  list(@CurrentUser() user: AccessUser): Promise<CaptureTokenListResponse> {
    return this.tokens.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AccessUser): Promise<CaptureTokenCreated> {
    return this.tokens.create(user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  revoke(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: captureTokenIdSchema }) id: string,
  ): Promise<void> {
    return this.tokens.revoke(user.id, id);
  }
}
