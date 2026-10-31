import { Module } from '@nestjs/common';

import { JwtKeysModule } from '../auth/index.js';
import { AiProcessor } from './ai.processor.js';
import { AiClient } from './ai-client.js';

@Module({
  imports: [JwtKeysModule],
  providers: [AiClient],
  exports: [AiClient],
})
export class AiModule {}

@Module({
  imports: [AiModule],
  providers: [AiProcessor],
})
export class AiWorkerModule {}
