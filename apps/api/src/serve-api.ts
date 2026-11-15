import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { boot } from './boot.js';
import type { AppConfig } from './config/app-config.js';
import { APP_OPTIONS, configureApp } from './configure-app.js';

await boot(async () => {
  const app = configureApp(
    await NestFactory.create<NestExpressApplication>(AppModule, APP_OPTIONS),
  );
  const config = app.get<AppConfig>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }), config.get('HOST', { infer: true }));
});
