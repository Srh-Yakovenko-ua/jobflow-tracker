import { ERROR_EVENT_DATA_COLLECTION, scrubErrorEvent } from '@jobflow/shared';
import * as Sentry from '@sentry/node';

import { loadProcessEnv } from '../config/env.js';
import type { TracedService } from '../tracing/tracing.js';

export type ErrorTracking = Sentry.NodeClient;

const NO_DATA_COLLECTION: NonNullable<Sentry.NodeOptions['dataCollection']> = {
  ...ERROR_EVENT_DATA_COLLECTION,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
};

export function startErrorTracking({
  service,
}: {
  service: TracedService;
}): ErrorTracking | undefined {
  const env = loadProcessEnv();
  if (env.SENTRY_DSN === undefined) {
    return undefined;
  }
  return Sentry.init({
    dsn: env.SENTRY_DSN,
    release: env.SENTRY_RELEASE,
    environment: env.NODE_ENV,
    initialScope: { tags: { service } },
    dataCollection: NO_DATA_COLLECTION,
    maxBreadcrumbs: 0,
    beforeSend: scrubErrorEvent,
  });
}
