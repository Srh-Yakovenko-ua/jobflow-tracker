import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsRepository } from './applications.repository.js';
import { ApplicationsService } from './applications.service.js';

@Module({
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationsRepository, Clock],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
