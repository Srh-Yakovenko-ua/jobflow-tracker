import type { NestApplicationOptions } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { REQUEST_ID_HEADER, requestId } from './common/request-id.middleware.js';
import type { AppConfig } from './config/app-config.js';

export const APP_OPTIONS = { bufferLogs: true, bodyParser: false } satisfies NestApplicationOptions;

export function configureApp(app: NestExpressApplication): NestExpressApplication {
  const config = app.get<AppConfig>(ConfigService);
  app.useLogger(app.get(Logger));
  app.use(requestId);
  app.use(helmet());
  app.useBodyParser('json', { limit: '1mb' });
  app.enableCors({
    origin: [config.get('WEB_ORIGIN', { infer: true })],
    credentials: true,
    exposedHeaders: [REQUEST_ID_HEADER],
  });
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  return app;
}
