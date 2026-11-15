import * as Sentry from '@sentry/nextjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { recordErrorReports, REPORT_LEAKS } from '@/test/error-reports';
import { quietLogs } from '@/test/quiet-logs';

import type { Incident } from './incident';
import { reportIncident } from './report-incident';

const INCIDENT: Incident = {
  code: '5f3a9c01',
  eventId: '5f3a9c01e2b44d6f8a7b6c5d4e3f2a1b',
  occurredAt: new Date('2026-09-07T13:04:00Z'),
};

afterEach(async () => {
  vi.restoreAllMocks();
  await Sentry.close();
});

describe('reportIncident', () => {
  it('logs the error under the code and event id the panel and GlitchTip share', () => {
    const logged = quietLogs();
    const error = new Error('boom');

    reportIncident({ error, incident: INCIDENT });

    expect(logged).toHaveBeenCalledWith({
      err: error,
      code: '5f3a9c01',
      eventId: '5f3a9c01e2b44d6f8a7b6c5d4e3f2a1b',
    });
  });

  it('sends one event under the incident event id, tagged with the shown code', async () => {
    quietLogs();
    const reports = recordErrorReports();

    reportIncident({ error: new Error('boom'), incident: INCIDENT });

    const [report, ...more] = await reports.flushed();
    expect(more).toEqual([]);
    expect(report?.eventId).toBe('5f3a9c01e2b44d6f8a7b6c5d4e3f2a1b');
    expect(report?.tags).toMatchObject({ code: '5f3a9c01', service: 'web' });
  });

  it('tags a server crash with its Next digest', async () => {
    quietLogs();
    const reports = recordErrorReports();
    const error = Object.assign(new Error('boom'), { digest: '2349875623' });

    reportIncident({ error, incident: INCIDENT });

    const [report] = await reports.flushed();
    expect(report?.tags).toMatchObject({ code: '5f3a9c01', digest: '2349875623' });
  });

  it('an error that quotes an email and a note sends neither', async () => {
    quietLogs();
    const reports = recordErrorReports();

    reportIncident({ error: new Error(REPORT_LEAKS.join(' ')), incident: INCIDENT });

    const [report] = await reports.flushed();
    expect(report?.serialized).toContain('"type":"Error"');
    expect(report?.serialized).not.toContain(REPORT_LEAKS[0]);
    expect(report?.serialized).not.toContain(REPORT_LEAKS[1]);
  });
});
