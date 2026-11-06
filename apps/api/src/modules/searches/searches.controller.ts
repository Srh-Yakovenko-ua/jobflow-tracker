import {
  type FinishSearchInput,
  finishSearchInputSchema,
  type FinishSearchResponse,
  type SearchListResponse,
} from '@jobflow/shared';
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { SearchesService } from './searches.service.js';

@Controller('searches')
export class SearchesController {
  constructor(private readonly searches: SearchesService) {}

  @Get()
  list(@CurrentUser() user: AccessUser): Promise<SearchListResponse> {
    return this.searches.list(user.id);
  }

  @Post('current/finish')
  @HttpCode(200)
  finish(
    @CurrentUser() user: AccessUser,
    @Body({ schema: finishSearchInputSchema }) input: FinishSearchInput,
  ): Promise<FinishSearchResponse> {
    return this.searches.finish(user.id, input);
  }
}
