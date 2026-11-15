import { ERROR_EVENT_DATA_COLLECTION, scrubErrorEvent } from '@jobflow/shared';
import type { BrowserOptions, ErrorEvent, EventHint } from '@sentry/nextjs';

import type { ErrorTrackingConfig } from './web-config';

export type ErrorTrackingOptions = Pick<
  BrowserOptions,
  'dsn' | 'release' | 'initialScope' | 'dataCollection' | 'maxBreadcrumbs' | 'beforeSend'
>;

function digestOf(thrown: unknown): string | undefined {
  if (typeof thrown !== 'object' || thrown === null || !('digest' in thrown)) return undefined;
  return typeof thrown.digest === 'string' ? thrown.digest : undefined;
}

function scrubbedWithDigest(event: ErrorEvent, hint: EventHint): ErrorEvent {
  const scrubbed = scrubErrorEvent(event);
  const digest = digestOf(hint.originalException);
  return digest === undefined ? scrubbed : { ...scrubbed, tags: { ...scrubbed.tags, digest } };
}

export function errorTrackingOptions({ dsn, release }: ErrorTrackingConfig): ErrorTrackingOptions {
  return {
    dsn,
    ...(release === undefined ? {} : { release }),
    initialScope: { tags: { service: 'web' } },
    dataCollection: ERROR_EVENT_DATA_COLLECTION,
    maxBreadcrumbs: 0,
    beforeSend: scrubbedWithDigest,
  };
}
