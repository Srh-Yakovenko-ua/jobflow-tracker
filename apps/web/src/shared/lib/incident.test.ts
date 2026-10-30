import { afterEach, describe, expect, it, vi } from 'vitest';

import { logIncident, newIncident } from './incident';
import { logger } from './logger';

const NOW = new Date('2026-09-07T13:04:00Z');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('newIncident', () => {
  it('a server crash shows the Next digest as its code', () => {
    const error = Object.assign(new Error('boom'), { digest: '2349875623' });

    expect(newIncident({ error, now: NOW })).toEqual({ code: '2349875623', occurredAt: NOW });
  });

  it('a client crash without a digest gets an 8-hex code', () => {
    expect(newIncident({ error: new Error('boom'), now: NOW }).code).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('logIncident', () => {
  it('logs the error under the same code the panel shows', () => {
    const logError = vi.spyOn(logger, 'error').mockReturnValue(undefined);
    const error = new Error('boom');

    logIncident({ error, incident: { code: '5f3a9c01', occurredAt: NOW } });

    expect(logError).toHaveBeenCalledWith({ err: error, code: '5f3a9c01' });
  });
});
