import { type RhythmQuery, rhythmQuerySchema, type RhythmResponse } from '@jobflow/shared';
import { Controller, Get, Query } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { RhythmService } from './rhythm.service.js';

@Controller('rhythm')
export class RhythmController {
  constructor(private readonly rhythm: RhythmService) {}

  @Get()
  get(
    @CurrentUser() user: AccessUser,
    @Query({ schema: rhythmQuerySchema }) query: RhythmQuery,
  ): Promise<RhythmResponse> {
    return this.rhythm.get(user.id, query);
  }
}
