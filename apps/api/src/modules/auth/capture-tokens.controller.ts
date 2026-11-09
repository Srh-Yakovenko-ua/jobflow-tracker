import { type CaptureTokenCreated, captureTokenIdSchema } from '@jobflow/shared';
import { Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';

import type { AccessUser } from './access-tokens.js';
import { CaptureTokensService } from './capture-tokens.service.js';
import { CurrentUser } from './current-user.decorator.js';

@Controller('capture/tokens')
export class CaptureTokensController {
  constructor(private readonly tokens: CaptureTokensService) {}

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
