import * as Sentry from '@sentry/nextjs';
import { vi } from 'vitest';
import { z } from 'zod';

import { errorTrackingOptions } from '@/shared/config';

export const REPORTS_TO = { dsn: 'http://public@localhost:8003/1', release: '59dbb20' };

export const REPORT_LEAKS = ['ivan.petrenko@example.com', 'нотатка: подзвонити Олені до пʼятниці'];

const envelopeHeaderSchema = z.object({ event_id: z.string().optional() });

const itemHeaderSchema = z.object({ type: z.string() });

const eventSchema = z.object({ tags: z.record(z.string(), z.string()).optional() });

export type SentReport = {
  eventId: string | undefined;
  tags: Record<string, string>;
  serialized: string;
};

function reportOf(serialized: string): SentReport | undefined {
  const [header = '{}', itemHeader = '{}', payload = '{}'] = serialized.split('\n');
  if (itemHeaderSchema.parse(JSON.parse(itemHeader)).type !== 'event') return undefined;
  return {
    eventId: envelopeHeaderSchema.parse(JSON.parse(header)).event_id,
    tags: eventSchema.parse(JSON.parse(payload)).tags ?? {},
    serialized,
  };
}

function textOf(body: string | Uint8Array): string {
  return typeof body === 'string' ? body : new TextDecoder().decode(body);
}

export function stubErrorTrackingEnv(): void {
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', REPORTS_TO.dsn);
  vi.stubEnv('NEXT_PUBLIC_SENTRY_RELEASE', REPORTS_TO.release);
}

export async function unsetErrorTracking(): Promise<void> {
  vi.unstubAllEnvs();
  await Sentry.close();
  Sentry.getCurrentScope().setClient(undefined);
}

export function recordErrorReports() {
  const sent: SentReport[] = [];
  const recording: Sentry.BrowserOptions = {
    ...errorTrackingOptions(REPORTS_TO),
    transport: (options) =>
      Sentry.createTransport(options, (request) => {
        const report = reportOf(textOf(request.body));
        if (report) sent.push(report);
        return Promise.resolve({ statusCode: 200 });
      }),
  };
  Sentry.init(recording);
  return {
    flushed: async () => {
      await Sentry.flush(1000);
      return sent;
    },
  };
}
