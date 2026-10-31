import type { Provider } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Logger, LoggerModule } from 'nestjs-pino';
import type { DestinationStream } from 'pino';

import { loggerParams } from '../common/logger.js';
import { configModule } from '../config/app-config.js';

export async function compileProcessorModule(
  sink: DestinationStream,
  providers: Provider[],
): Promise<TestingModule> {
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, LoggerModule.forRoot(loggerParams(sink))],
    providers,
  }).compile();
  moduleRef.useLogger(moduleRef.get(Logger));
  return moduleRef;
}
