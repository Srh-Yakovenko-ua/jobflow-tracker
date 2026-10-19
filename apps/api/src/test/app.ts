import type { ModuleMetadata } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';

import { AppModule } from '../app.module.js';
import { APP_OPTIONS, configureApp } from '../configure-app.js';

export function appTestingModule(metadata: ModuleMetadata = {}): TestingModuleBuilder {
  return Test.createTestingModule({
    ...metadata,
    imports: [AppModule, ...(metadata.imports ?? [])],
  });
}

export async function startTestApp(
  builder: TestingModuleBuilder = appTestingModule(),
): Promise<NestExpressApplication> {
  const moduleRef = await builder.compile();
  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(APP_OPTIONS));
  await app.init();
  return app;
}
