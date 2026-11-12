import { applicationIdSchema, type ApplicationMatchResponse } from '@jobflow/shared';
import { Controller, Get, Param } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { MatchService } from './match.service.js';

@Controller('applications')
export class MatchController {
  constructor(private readonly match: MatchService) {}

  @Get(':id/match')
  read(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
  ): Promise<ApplicationMatchResponse> {
    return this.match.read(user.id, id);
  }
}
