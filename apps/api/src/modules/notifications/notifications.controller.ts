import {
  type MarkNotificationsReadInput,
  markNotificationsReadInputSchema,
  type MarkNotificationsReadResponse,
  type NotificationListQuery,
  notificationListQuerySchema,
  type NotificationListResponse,
} from '@jobflow/shared';
import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AccessUser,
    @Query({ schema: notificationListQuerySchema }) query: NotificationListQuery,
  ): Promise<NotificationListResponse> {
    return this.notifications.list(user.id, query);
  }

  @Post('read')
  @HttpCode(200)
  markRead(
    @CurrentUser() user: AccessUser,
    @Body({ schema: markNotificationsReadInputSchema }) input: MarkNotificationsReadInput,
  ): Promise<MarkNotificationsReadResponse> {
    return this.notifications.markRead(user.id, input);
  }
}
