import * as Sentry from '@sentry/nextjs';

import type { Incident, IncidentError } from './incident';
import { logger } from './logger';

export type ReportIncidentInput = { error: IncidentError; incident: Incident };

export function reportIncident({ error, incident }: ReportIncidentInput): void {
  const { code, eventId } = incident;
  logger.error({ err: error, code, eventId });
  Sentry.withScope((scope) => {
    scope.setTags({ code, ...(error.digest === undefined ? {} : { digest: error.digest }) });
    Sentry.captureException(error, { event_id: eventId });
  });
}
