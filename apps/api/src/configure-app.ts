import { CAPTURE_BOOKMARKLET_LIMITS } from '@jobflow/shared';
import { type NestApplicationOptions, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { BOOT_OPTIONS } from './boot.js';
import { API_PREFIX, JWKS_PATH, rejectOutsidePrefix } from './common/api-prefix.middleware.js';
import { BOOKMARKLET_PATH, corsFor } from './common/cors.js';
import { requestId } from './common/request-id.middleware.js';
import type { AppConfig } from './config/app-config.js';
import { mountApiDocs } from './openapi/api-docs.js';
import { mountBullBoard } from './queues/bull-board.js';

export const APP_OPTIONS = { ...BOOT_OPTIONS, bodyParser: false } satisfies NestApplicationOptions;

export function configureApp(app: NestExpressApplication): NestExpressApplication {
  const config = app.get<AppConfig>(ConfigService);
  app.useLogger(app.get(Logger));
  app.use(requestId);
  if (config.get('NODE_ENV', { infer: true }) === 'development') {
    mountBullBoard(app);
    mountApiDocs(app);
  }
  app.use(helmet());
  app.enableCors(corsFor(config.get('WEB_ORIGIN', { infer: true })));
  app.use(rejectOutsidePrefix);
  app.use(BOOKMARKLET_PATH, json({ limit: CAPTURE_BOOKMARKLET_LIMITS.bodyMaxBytes }));
  app.useBodyParser('json', { limit: '1mb' });
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [{ path: JWKS_PATH, method: RequestMethod.GET }],
  });
  app.enableShutdownHooks();
  return app;
}
