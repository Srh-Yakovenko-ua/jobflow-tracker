import { Module } from '@nestjs/common';

import { Clock } from '../common/clock.js';
import { ScheduledJobsRepository } from './scheduled-jobs.repository.js';
import { ScheduledJobsService } from './scheduled-jobs.service.js';

@Module({
  providers: [ScheduledJobsRepository, ScheduledJobsService, Clock],
  exports: [ScheduledJobsService],
})
export class ScheduledJobsModule {}
