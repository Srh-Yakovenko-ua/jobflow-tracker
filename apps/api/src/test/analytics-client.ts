import { ConfigService } from '@nestjs/config';

import { AnalyticsClient } from '../analytics-client/index.js';
import { validateEnv } from '../config/env.js';
import { testJwtKeys } from './auth.js';
import { exampleEnv } from './example-env.js';
import type { FetchReply } from './fetch.js';

export const ANALYTICS_URL = 'http://analytics.test:8000';

export const ANALYTICS = `${ANALYTICS_URL}/analytics`;

export const jsonReply =
  (body: unknown): FetchReply =>
  () =>
    Response.json(body);

export const analyticsClient = () =>
  new AnalyticsClient(
    new ConfigService(validateEnv({ ...exampleEnv, ANALYTICS_URL })),
    testJwtKeys,
  );

export const analyticsClientProvider = () => ({
  provide: AnalyticsClient,
  useValue: analyticsClient(),
});
