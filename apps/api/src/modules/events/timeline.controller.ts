import { applicationIdSchema, type ApplicationTimelineResponse } from '@jobflow/shared';
import { Controller, Get, Param } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { TimelineService } from './timeline.service.js';

@Controller('applications')
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get(':id/timeline')
  list(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
  ): Promise<ApplicationTimelineResponse> {
    return this.timeline.list(user.id, id);
  }
}
