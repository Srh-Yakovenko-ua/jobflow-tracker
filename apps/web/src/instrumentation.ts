import * as Sentry from '@sentry/nextjs';

import { config, errorTrackingOptions } from '@/shared/config';

export function register(): void {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || config.errorTracking === undefined) return;
  Sentry.init({ ...errorTrackingOptions(config.errorTracking), enableOpenTelemetrySetup: false });
}

export const onRequestError = Sentry.captureRequestError;
