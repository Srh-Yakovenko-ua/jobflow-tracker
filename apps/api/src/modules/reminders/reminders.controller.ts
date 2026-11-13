import {
  type Reminder,
  reminderIdSchema,
  type ReminderListResponse,
  type SnoozeReminderInput,
  snoozeReminderInputSchema,
} from '@jobflow/shared';
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { RemindersService } from './reminders.service.js';

@Controller('reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get()
  list(@CurrentUser() user: AccessUser): Promise<ReminderListResponse> {
    return this.reminders.list(user.id);
  }

  @Post(':id/done')
  @HttpCode(200)
  done(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: reminderIdSchema }) id: string,
  ): Promise<Reminder> {
    return this.reminders.done(user.id, id);
  }

  @Post(':id/dismiss')
  @HttpCode(200)
  dismiss(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: reminderIdSchema }) id: string,
  ): Promise<Reminder> {
    return this.reminders.dismiss(user.id, id);
  }

  @Post(':id/snooze')
  @HttpCode(200)
  snooze(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: reminderIdSchema }) id: string,
    @Body({ schema: snoozeReminderInputSchema }) { days }: SnoozeReminderInput,
  ): Promise<Reminder> {
    return this.reminders.snooze(user.id, { id, days });
  }
}
