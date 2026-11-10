import { Module } from '@nestjs/common';

import { AiModule } from '../ai/index.js';
import { JobsController } from './jobs.controller.js';

@Module({
  imports: [AiModule],
  controllers: [JobsController],
})
export class JobsModule {}
