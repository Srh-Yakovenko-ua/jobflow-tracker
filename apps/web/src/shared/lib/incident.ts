const CODE_LENGTH = 8;

export type Incident = { code: string; eventId: string; occurredAt: Date };

export type IncidentError = Error & { digest?: string | undefined };

export type NewIncidentInput = { now: Date };

export function newIncident({ now }: NewIncidentInput): Incident {
  const eventId = crypto.randomUUID().replaceAll('-', '');
  return { code: eventId.slice(0, CODE_LENGTH), eventId, occurredAt: now };
}
