import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { LiveModule } from '../live/index.js';
import { ApplicationDraftsRepository } from './application-drafts.repository.js';
import { ApplicationDraftsService } from './application-drafts.service.js';
import { ApplicationDuplicatesRepository } from './application-duplicates.repository.js';
import { ApplicationListRepository } from './application-list.repository.js';
import { ApplicationListService } from './application-list.service.js';
import { ApplicationLiveSubscriber } from './application-live.subscriber.js';
import { ApplicationSearchRepository } from './application-search.repository.js';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsRepository } from './applications.repository.js';
import { ApplicationsService } from './applications.service.js';
import { SearchApplicationsRepository } from './search-applications.repository.js';
import { SearchApplicationsService } from './search-applications.service.js';
import { StageTransitionRepository } from './stage-transition.repository.js';
import { StageTransitionService } from './stage-transition.service.js';

@Module({
  controllers: [ApplicationsController],
  providers: [
    ApplicationsService,
    ApplicationDraftsService,
    ApplicationsRepository,
    ApplicationDraftsRepository,
    ApplicationDuplicatesRepository,
    ApplicationListService,
    ApplicationListRepository,
    ApplicationSearchRepository,
    StageTransitionService,
    StageTransitionRepository,
    SearchApplicationsService,
    SearchApplicationsRepository,
    Clock,
  ],
  exports: [ApplicationsService, ApplicationDraftsService, SearchApplicationsService],
})
export class ApplicationsModule {}

@Module({
  imports: [OutboxWorkerModule, LiveModule],
  providers: [ApplicationLiveSubscriber],
})
export class ApplicationsWorkerModule {}
