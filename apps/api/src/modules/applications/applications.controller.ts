import {
  applicationIdSchema,
  type ApplicationResponse,
  type CreateApplicationInput,
  createApplicationInputSchema,
  type UpdateApplicationInput,
  updateApplicationInputSchema,
} from '@jobflow/shared';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { ApplicationsService } from './applications.service.js';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  create(
    @CurrentUser() user: AccessUser,
    @Body({ schema: createApplicationInputSchema }) input: CreateApplicationInput,
  ): Promise<ApplicationResponse> {
    return this.applications.create(user.id, input);
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

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) id: string,
  ): Promise<void> {
    return this.applications.remove(user.id, id);
  }
}
