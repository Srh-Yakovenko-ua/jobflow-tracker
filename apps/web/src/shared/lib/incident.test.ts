import { describe, expect, it } from 'vitest';

import { newIncident } from './incident';

const NOW = new Date('2026-09-07T13:04:00Z');

describe('newIncident', () => {
  it('gives every crash a 32-hex event id, the Sentry shape', () => {
    expect(newIncident({ now: NOW }).eventId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('shows the first 8 hex of the event id as the code and keeps the time', () => {
    const incident = newIncident({ now: NOW });

    expect(incident.code).toMatch(/^[0-9a-f]{8}$/);
    expect(incident.eventId.startsWith(incident.code)).toBe(true);
    expect(incident.occurredAt).toBe(NOW);
  });

  it('two crashes never share an event id', () => {
    expect(newIncident({ now: NOW }).eventId).not.toBe(newIncident({ now: NOW }).eventId);
  });
});
