import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { ApplicationListRepository } from './application-list.repository.js';
import { ApplicationListService } from './application-list.service.js';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsRepository } from './applications.repository.js';
import { ApplicationsService } from './applications.service.js';

@Module({
  controllers: [ApplicationsController],
  providers: [
    ApplicationsService,
    ApplicationsRepository,
    ApplicationListService,
    ApplicationListRepository,
    Clock,
  ],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
