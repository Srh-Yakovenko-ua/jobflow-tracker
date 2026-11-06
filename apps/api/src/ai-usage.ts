import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AiUsageModule } from './ai-usage/ai-usage.module.js';
import { AiUsageService } from './ai-usage/ai-usage.service.js';
import { boot, BOOT_OPTIONS } from './boot.js';

await boot(async () => {
  const app = await NestFactory.createApplicationContext(AiUsageModule, BOOT_OPTIONS);
  app.useLogger(app.get(Logger));
  const lines = await app.get(AiUsageService).report();
  process.stdout.write(`${lines.join('\n')}\n`);
  await app.close();
});
