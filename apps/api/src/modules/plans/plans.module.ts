import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { PlansController } from './plans.controller.js';
import { PlansRepository } from './plans.repository.js';
import { PlansService } from './plans.service.js';

@Module({
  controllers: [PlansController],
  providers: [PlansService, PlansRepository, Clock],
  exports: [PlansService],
})
export class PlansModule {}
