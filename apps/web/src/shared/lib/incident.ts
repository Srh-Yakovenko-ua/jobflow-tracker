import { logger } from './logger';

const CODE_LENGTH = 8;

export type Incident = { code: string; occurredAt: Date };

export type IncidentError = Error & { digest?: string | undefined };

export type NewIncidentInput = { error: IncidentError; now: Date };

export type LogIncidentInput = { error: IncidentError; incident: Incident };

export function newIncident({ error, now }: NewIncidentInput): Incident {
  return { code: error.digest ?? crypto.randomUUID().slice(0, CODE_LENGTH), occurredAt: now };
}

export function logIncident({ error, incident }: LogIncidentInput): void {
  logger.error({ err: error, code: incident.code });
}
