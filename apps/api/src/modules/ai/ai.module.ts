import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { JwtKeysModule } from '../auth/index.js';
import { LiveModule } from '../live/index.js';
import { AiController } from './ai.controller.js';
import { AiProcessor } from './ai.processor.js';
import { AiRepository } from './ai.repository.js';
import { AiService } from './ai.service.js';
import { AiClient } from './ai-client.js';
import { AiJobRouter } from './ai-job-router.js';
import { AiJobStatusService } from './ai-job-status.service.js';

@Module({
  imports: [JwtKeysModule],
  controllers: [AiController],
  providers: [AiClient, AiService, AiJobStatusService, AiRepository, AiJobRouter, Clock],
  exports: [AiClient, AiService, AiJobStatusService, AiJobRouter],
})
export class AiModule {}

@Module({
  imports: [AiModule, LiveModule],
  providers: [AiProcessor],
})
export class AiWorkerModule {}
