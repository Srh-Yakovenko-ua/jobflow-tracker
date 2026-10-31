import { type CalendarQuery, calendarQuerySchema, type CalendarResponse } from '@jobflow/shared';
import { Controller, Get, Query } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { CalendarService } from './calendar.service.js';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  items(
    @CurrentUser() user: AccessUser,
    @Query({ schema: calendarQuerySchema }) query: CalendarQuery,
  ): Promise<CalendarResponse> {
    return this.calendar.items(user.id, query);
  }
}
