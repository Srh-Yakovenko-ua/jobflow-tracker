import {
  applicationIdSchema,
  type CreateScheduledEventInput,
  createScheduledEventInputSchema,
  type ScheduledEvent,
  scheduledEventIdSchema,
  type ScheduledEventListResponse,
  type ScheduledEventUpdateResponse,
  type UpdateScheduledEventInput,
  updateScheduledEventInputSchema,
} from '@jobflow/shared';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { ScheduledEventsService } from './scheduled-events.service.js';

export const ICS_HEADERS = {
  'Content-Type': 'text/calendar; charset=utf-8',
  'Content-Disposition': 'attachment; filename="jobflow-event.ics"',
} as const;

@Controller('applications')
export class ScheduledEventsController {
  constructor(private readonly scheduledEvents: ScheduledEventsService) {}

  @Post(':id/scheduled-events')
  create(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) applicationId: string,
    @Body({ schema: createScheduledEventInputSchema }) input: CreateScheduledEventInput,
  ): Promise<ScheduledEvent> {
    return this.scheduledEvents.create(user.id, { applicationId, input });
  }

  @Get(':id/scheduled-events')
  list(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) applicationId: string,
  ): Promise<ScheduledEventListResponse> {
    return this.scheduledEvents.list(user.id, applicationId);
  }

  @Patch(':id/scheduled-events/:eventId')
  update(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) applicationId: string,
    @Param('eventId', { schema: scheduledEventIdSchema }) eventId: string,
    @Body({ schema: updateScheduledEventInputSchema }) input: UpdateScheduledEventInput,
  ): Promise<ScheduledEventUpdateResponse> {
    return this.scheduledEvents.update(user.id, { applicationId, eventId, input });
  }

  @Delete(':id/scheduled-events/:eventId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) applicationId: string,
    @Param('eventId', { schema: scheduledEventIdSchema }) eventId: string,
  ): Promise<void> {
    return this.scheduledEvents.remove(user.id, { applicationId, eventId });
  }

  @Get(':id/scheduled-events/:eventId/ics')
  async ics(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) applicationId: string,
    @Param('eventId', { schema: scheduledEventIdSchema }) eventId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const ics = await this.scheduledEvents.ics(user.id, { applicationId, eventId });
    res.set(ICS_HEADERS);
    return ics;
  }
}
