import { SpanKind, trace } from '@opentelemetry/api';
import { describe, expect, it } from 'vitest';

import { recordSpans } from '../test/tracing.js';
import { URL_REDACTION } from './tracing.js';

const spans = recordSpans({ processors: [URL_REDACTION] });

const USER_ID = '0199f0a0-0000-7000-8000-000000000001';

const RESUME_ID = '0199f0a0-0000-7000-8000-0000000000b1';

const PUSH_TOKEN = 'cXyZ9:APA91bH-Olena_Chrome_Token';

async function clientSpanOf(href: string): Promise<Record<string, unknown>> {
  const url = new URL(href);
  trace
    .getTracer('probe')
    .startSpan('PUT', {
      kind: SpanKind.CLIENT,
      attributes: { 'url.full': url.href, 'url.path': url.pathname, 'url.query': url.search },
    })
    .end();
  const [span] = await spans.named('PUT');
  return { ...span?.attributes };
}

const valuesOf = (attributes: Record<string, unknown>) => JSON.stringify(Object.values(attributes));

describe('URL_REDACTION on outgoing client spans', () => {
  it('a MinIO span carries no user id', async () => {
    const attributes = await clientSpanOf(
      `http://localhost:9000/resumes/users/${USER_ID}/resumes/${RESUME_ID}.pdf?X-Amz-Signature=abc123signed`,
    );

    expect(attributes).toEqual({
      'url.full': 'http://localhost:9000/resumes/users/:id/resumes/:id',
      'url.path': '/resumes/users/:id/resumes/:id',
      'url.query': 'REDACTED',
    });
    expect(valuesOf(attributes)).not.toMatch(new RegExp(`${USER_ID}|${RESUME_ID}|abc123signed`));
  });

  it('a web-push span carries no subscription endpoint', async () => {
    const attributes = await clientSpanOf(`https://fcm.googleapis.com/fcm/send/${PUSH_TOKEN}`);

    expect(attributes).toEqual({
      'url.full': 'https://fcm.googleapis.com/fcm/send/:id',
      'url.path': '/fcm/send/:id',
      'url.query': '',
    });
    expect(valuesOf(attributes)).not.toContain(PUSH_TOKEN);
  });

  it('keeps the AI route of a client span readable', async () => {
    const attributes = await clientSpanOf('http://localhost:8001/v1/complete/vacancy_parse');

    expect(attributes['url.full']).toBe('http://localhost:8001/v1/complete/vacancy_parse');
    expect(attributes['url.path']).toBe('/v1/complete/vacancy_parse');
  });
});
