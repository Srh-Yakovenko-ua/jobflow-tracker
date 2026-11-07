import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { StorageModule } from '../../storage/storage.module.js';
import { EventsModule } from '../events/index.js';
import { ResumeLinksController } from './resume-links.controller.js';
import { ResumeLinksService } from './resume-links.service.js';
import { ResumeUploadsController } from './resume-uploads.controller.js';
import { ResumeUploadsService } from './resume-uploads.service.js';
import { ResumeVersionsController } from './resume-versions.controller.js';
import { ResumeVersionsRepository } from './resume-versions.repository.js';
import { ResumeVersionsService } from './resume-versions.service.js';

@Module({
  imports: [StorageModule, EventsModule],
  controllers: [ResumeUploadsController, ResumeVersionsController, ResumeLinksController],
  providers: [
    ResumeUploadsService,
    ResumeVersionsService,
    ResumeLinksService,
    ResumeVersionsRepository,
    Clock,
  ],
})
export class ResumesModule {}
