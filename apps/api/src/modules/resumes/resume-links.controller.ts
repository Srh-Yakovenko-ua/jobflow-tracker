import {
  applicationIdSchema,
  type RelinkResumeVersionInput,
  relinkResumeVersionInputSchema,
} from '@jobflow/shared';
import { Body, Controller, HttpCode, Param, Patch } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { ResumeLinksService } from './resume-links.service.js';

@Controller('applications')
export class ResumeLinksController {
  constructor(private readonly links: ResumeLinksService) {}

  @Patch(':id/resume-version')
  @HttpCode(204)
  relink(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) applicationId: string,
    @Body({ schema: relinkResumeVersionInputSchema }) { resumeVersionId }: RelinkResumeVersionInput,
  ): Promise<void> {
    return this.links.relink(user.id, { applicationId, resumeVersionId });
  }
}
