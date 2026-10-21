import type { ModuleMetadata } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach } from 'vitest';

import { AppModule } from '../app.module.js';
import { APP_OPTIONS, configureApp } from '../configure-app.js';
import { JwtKeys } from '../modules/auth/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { testJwtKeys } from './auth.js';
import { resetDatabase } from './database.js';

export type TestApp = { readonly app: NestExpressApplication; readonly prisma: PrismaService };

export function appTestingModule(metadata: ModuleMetadata = {}): TestingModuleBuilder {
  return Test.createTestingModule({
    ...metadata,
    imports: [AppModule, ...(metadata.imports ?? [])],
  })
    .overrideProvider(JwtKeys)
    .useValue(testJwtKeys);
}

export async function startTestApp(
  builder: TestingModuleBuilder = appTestingModule(),
): Promise<NestExpressApplication> {
  const moduleRef = await builder.compile();
  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(APP_OPTIONS));
  await app.init();
  return app;
}

export function useTestApp(builder: () => TestingModuleBuilder = appTestingModule): TestApp {
  let started: NestExpressApplication | undefined;
  const testApp = {
    get app(): NestExpressApplication {
      if (!started) throw new Error('useTestApp is read before its beforeAll ran');
      return started;
    },
    get prisma(): PrismaService {
      return testApp.app.get(PrismaService);
    },
  };

  beforeAll(async () => {
    started = await startTestApp(builder());
  });
  beforeEach(() => resetDatabase(testApp.prisma));
  afterAll(() => started?.close());

  return testApp;
}
