import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { JwtKeysModule } from '../auth/index.js';
import { AiController } from './ai.controller.js';
import { AiProcessor } from './ai.processor.js';
import { AiRepository } from './ai.repository.js';
import { AiService } from './ai.service.js';
import { AiClient } from './ai-client.js';
import { AiJobRouter } from './ai-job-router.js';

@Module({
  imports: [JwtKeysModule],
  controllers: [AiController],
  providers: [AiClient, AiService, AiRepository, AiJobRouter, Clock],
  exports: [AiClient, AiService, AiJobRouter],
})
export class AiModule {}

@Module({
  imports: [AiModule],
  providers: [AiProcessor],
})
export class AiWorkerModule {}
