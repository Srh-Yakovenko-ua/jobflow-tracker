import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { Clock } from '../common/clock.js';
import { loggerParams } from '../common/logger.js';
import { configModule } from '../config/app-config.js';
import { AiClient } from '../modules/ai/index.js';
import { JwtKeysModule } from '../modules/auth/index.js';
import { DocumentsClient } from '../modules/resumes/index.js';
import { AiEvalService } from './ai-eval.service.js';

@Module({
  imports: [configModule, LoggerModule.forRoot(loggerParams()), JwtKeysModule],
  providers: [AiClient, DocumentsClient, Clock, AiEvalService],
})
export class AiEvalModule {}
