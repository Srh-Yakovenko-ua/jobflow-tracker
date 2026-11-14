import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { boot, BOOT_OPTIONS } from './boot.js';
import { DemoModule } from './demo/demo.module.js';
import { DemoService } from './demo/demo.service.js';
import { DemoCvFiles } from './demo/demo-cv-files.service.js';

await boot(async () => {
  const app = await NestFactory.createApplicationContext(DemoModule, BOOT_OPTIONS);
  app.useLogger(app.get(Logger));
  await app.get(DemoCvFiles).store(await app.get(DemoService).run());
  await app.close();
});
