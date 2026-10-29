import {
  type ApplicationBoardQuery,
  applicationBoardQuerySchema,
  type ApplicationBoardResponse,
  applicationIdSchema,
  type ApplicationListResponse,
  type ApplicationResponse,
  type CreateApplicationInput,
  createApplicationInputSchema,
  type MoveApplicationInput,
  moveApplicationInputSchema,
  type UpdateApplicationInput,
  updateApplicationInputSchema,
} from '@jobflow/shared';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { type ApplicationListRequest, applicationListRequestSchema } from './application-cursor.js';
import { ApplicationListService } from './application-list.service.js';
import { ApplicationsService } from './applications.service.js';
import { StageTransitionService } from './stage-transition.service.js';

@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly applications: ApplicationsService,
    private readonly applicationList: ApplicationListService,
    private readonly stageTransitions: StageTransitionService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AccessUser,
    @Body({ schema: createApplicationInputSchema }) input: CreateApplicationInput,
  ): Promise<ApplicationResponse> {
    return this.applications.create(user.id, input);
  }

  @Get()
  list(
    @CurrentUser() user: AccessUser,
    @Query({ schema: applicationListRequestSchema }) query: ApplicationListRequest,
  ): Promise<ApplicationListResponse> {
    return this.applicationList.list(user.id, query);
  }

  @Get('board')
  board(
    @CurrentUser() user: AccessUser,
    @Query({ schema: applicationBoardQuerySchema }) query: ApplicationBoardQuery,
  ): Promise<ApplicationBoardResponse> {
    return this.applicationList.board(user.id, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
  ): Promise<ApplicationResponse> {
    return this.applications.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
    @Body({ schema: updateApplicationInputSchema }) input: UpdateApplicationInput,
  ): Promise<ApplicationResponse> {
    return this.applications.update(user.id, { id, input });
  }

  @Post(':id/events')
  move(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
    @Body({ schema: moveApplicationInputSchema }) input: MoveApplicationInput,
  ): Promise<ApplicationResponse> {
    return this.stageTransitions.move(user.id, { id, input });
  }

  @Post(':id/events/undo-last')
  undoLast(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
  ): Promise<ApplicationResponse> {
    return this.stageTransitions.undoLast(user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
  ): Promise<void> {
    return this.applications.remove(user.id, id);
  }
}
