import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { boot, BOOT_OPTIONS } from './boot.js';
import { SeedModule } from './seed/seed.module.js';
import { SeedService } from './seed/seed.service.js';

await boot(async () => {
  const app = await NestFactory.createApplicationContext(SeedModule, BOOT_OPTIONS);
  app.useLogger(app.get(Logger));
  await app.get(SeedService).run();
  await app.close();
});
