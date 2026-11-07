import {
  type CreateResumeVersionInput,
  createResumeVersionInputSchema,
  type ResumeDownload,
  type ResumeVersion,
  resumeVersionIdSchema,
  type ResumeVersionListResponse,
  type UpdateResumeVersionInput,
  updateResumeVersionInputSchema,
} from '@jobflow/shared';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';

import { Idempotent } from '../../common/idempotency/idempotent.decorator.js';
import { type AccessUser, CurrentUser } from '../auth/index.js';
import { ResumeUploadsService } from './resume-uploads.service.js';
import { ResumeVersionsService } from './resume-versions.service.js';

@Controller('resumes/versions')
export class ResumeVersionsController {
  constructor(
    private readonly versions: ResumeVersionsService,
    private readonly uploads: ResumeUploadsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AccessUser): Promise<ResumeVersionListResponse> {
    return this.versions.list(user.id);
  }

  @Post()
  @Idempotent()
  create(
    @CurrentUser() user: AccessUser,
    @Body({ schema: createResumeVersionInputSchema }) input: CreateResumeVersionInput,
  ): Promise<ResumeVersion> {
    return this.uploads.createVersion(user.id, input);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: resumeVersionIdSchema }) id: string,
    @Body({ schema: updateResumeVersionInputSchema }) input: UpdateResumeVersionInput,
  ): Promise<ResumeVersion> {
    return this.versions.update(user.id, { id, input });
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: resumeVersionIdSchema }) id: string,
  ): Promise<void> {
    return this.versions.remove(user.id, id);
  }

  @Post(':id/activate')
  @HttpCode(204)
  activate(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: resumeVersionIdSchema }) id: string,
  ): Promise<void> {
    return this.versions.activate(user.id, id);
  }

  @Get(':id/download')
  download(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: resumeVersionIdSchema }) id: string,
  ): Promise<ResumeDownload> {
    return this.versions.download(user.id, id);
  }
}
