import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { StorageModule } from '../../storage/storage.module.js';
import { ResumeUploadsController } from './resume-uploads.controller.js';
import { ResumeUploadsService } from './resume-uploads.service.js';

@Module({
  imports: [StorageModule],
  controllers: [ResumeUploadsController],
  providers: [ResumeUploadsService, Clock],
})
export class ResumesModule {}
