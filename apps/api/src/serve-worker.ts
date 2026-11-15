import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { boot, BOOT_OPTIONS } from './boot.js';
import { WorkerModule } from './worker.module.js';

await boot(async () => {
  const worker = await NestFactory.createApplicationContext(WorkerModule, BOOT_OPTIONS);
  worker.useLogger(worker.get(Logger));
  worker.enableShutdownHooks();
});
