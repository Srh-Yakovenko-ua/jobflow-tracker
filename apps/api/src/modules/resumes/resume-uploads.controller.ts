import {
  type ConfirmedResumeUpload,
  type ConfirmResumeUploadInput,
  confirmResumeUploadInputSchema,
  type ResumeUploadInput,
  resumeUploadInputSchema,
  type ResumeUploadTicket,
  uploadIdSchema,
} from '@jobflow/shared';
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { ResumeUploadsService } from './resume-uploads.service.js';

@Controller('uploads')
export class ResumeUploadsController {
  constructor(private readonly uploads: ResumeUploadsService) {}

  @Post('resume')
  createTicket(
    @CurrentUser() user: AccessUser,
    @Body({ schema: resumeUploadInputSchema }) input: ResumeUploadInput,
  ): Promise<ResumeUploadTicket> {
    return this.uploads.createUploadTicket(user.id, input);
  }

  @Post('resume/:uploadId/confirm')
  @HttpCode(200)
  confirm(
    @CurrentUser() user: AccessUser,
    @Param('uploadId', { schema: uploadIdSchema }) uploadId: string,
    @Body({ schema: confirmResumeUploadInputSchema }) input: ConfirmResumeUploadInput,
  ): Promise<ConfirmedResumeUpload> {
    return this.uploads.confirm(user.id, { uploadId, ...input });
  }
}
