import type { TestingModuleBuilder } from '@nestjs/testing';
import type { Response } from 'supertest';

import { appTestingModule } from './app.js';
import { overrideBullConfig, testQueuePrefix } from './bull-config.js';

export function devToolsTestingModule(): TestingModuleBuilder {
  return overrideBullConfig(appTestingModule(), { prefix: testQueuePrefix() });
}

export function cspDirectives(response: Response): Map<string, string> {
  return new Map(
    String(response.headers['content-security-policy'])
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .map(([name = '', ...sources]) => [name, sources.join(' ')]),
  );
}
