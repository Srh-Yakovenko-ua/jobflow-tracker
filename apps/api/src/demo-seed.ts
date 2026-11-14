import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { boot, BOOT_OPTIONS } from './boot.js';
import { DemoModule } from './demo/demo.module.js';
import { DemoReseed } from './demo/demo-reseed.service.js';

await boot(async () => {
  const app = await NestFactory.createApplicationContext(DemoModule, BOOT_OPTIONS);
  app.useLogger(app.get(Logger));
  await app.get(DemoReseed).run();
  await app.close();
});
