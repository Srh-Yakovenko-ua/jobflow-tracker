import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { loggerParams } from './common/logger.js';
import { configModule } from './config/app-config.js';

@Module({
  imports: [configModule, LoggerModule.forRoot(loggerParams())],
})
export class WorkerModule {}
