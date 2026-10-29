import { Module } from '@nestjs/common';

import { TimelineController } from './timeline.controller.js';
import { TimelineRepository } from './timeline.repository.js';
import { TimelineService } from './timeline.service.js';

@Module({
  controllers: [TimelineController],
  providers: [TimelineService, TimelineRepository],
  exports: [TimelineService],
})
export class EventsModule {}
