import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { StorageModule } from '../../storage/storage.module.js';
import { AiModule } from '../ai/index.js';
import { EventsModule } from '../events/index.js';
import { DocumentsClient } from './documents-client.js';
import { ResumeExtractionService } from './resume-extraction.service.js';
import { ResumeLinksController } from './resume-links.controller.js';
import { ResumeLinksService } from './resume-links.service.js';
import { ResumeProfileService } from './resume-profile.service.js';
import { ResumeProfileQueueService } from './resume-profile-queue.service.js';
import { ResumeProfileSubscriber } from './resume-profile-subscriber.service.js';
import { ResumeUploadsController } from './resume-uploads.controller.js';
import { ResumeUploadsService } from './resume-uploads.service.js';
import { ResumeVersionWriter } from './resume-version-writer.js';
import { ResumeVersionsController } from './resume-versions.controller.js';
import { ResumeVersionsRepository } from './resume-versions.repository.js';
import { ResumeVersionsService } from './resume-versions.service.js';

@Module({
  imports: [StorageModule, EventsModule, AiModule],
  controllers: [ResumeUploadsController, ResumeVersionsController, ResumeLinksController],
  providers: [
    ResumeUploadsService,
    ResumeVersionWriter,
    ResumeVersionsService,
    ResumeLinksService,
    ResumeVersionsRepository,
    Clock,
  ],
})
export class ResumesModule {}

@Module({
  imports: [OutboxWorkerModule, AiModule, StorageModule],
  providers: [
    DocumentsClient,
    ResumeVersionsRepository,
    ResumeExtractionService,
    ResumeProfileQueueService,
    ResumeProfileService,
    ResumeProfileSubscriber,
  ],
})
export class ResumesWorkerModule {}
