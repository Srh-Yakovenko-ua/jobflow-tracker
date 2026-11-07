import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { JwtKeysModule } from '../auth/index.js';
import { AiController } from './ai.controller.js';
import { AiProcessor } from './ai.processor.js';
import { AiRepository } from './ai.repository.js';
import { AiService } from './ai.service.js';
import { AiClient } from './ai-client.js';

@Module({
  imports: [JwtKeysModule],
  controllers: [AiController],
  providers: [AiClient, AiService, AiRepository, Clock],
  exports: [AiClient, AiService],
})
export class AiModule {}

@Module({
  imports: [AiModule],
  providers: [AiProcessor],
})
export class AiWorkerModule {}
