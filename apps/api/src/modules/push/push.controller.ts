import {
  type PushPublicKey,
  type PushSubscriptionCreated,
  pushSubscriptionCreatedSchema,
  type PushSubscriptionInput,
  pushSubscriptionInputSchema,
} from '@jobflow/shared';
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { PushService } from './push.service.js';

@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('public-key')
  publicKey(): PushPublicKey {
    return this.push.publicKey();
  }

  @Post('subscriptions')
  @HttpCode(201)
  subscribe(
    @CurrentUser() user: AccessUser,
    @Body({ schema: pushSubscriptionInputSchema }) input: PushSubscriptionInput,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<PushSubscriptionCreated> {
    return this.push.subscribe(user.id, { input, userAgent });
  }

  @Delete('subscriptions/:id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: pushSubscriptionCreatedSchema.shape.id }) id: string,
  ): Promise<void> {
    return this.push.remove(user.id, id);
  }
}
