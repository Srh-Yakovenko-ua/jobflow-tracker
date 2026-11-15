import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';

import { SpanKind, trace } from '@opentelemetry/api';
import { describe, expect, it } from 'vitest';

import { recordSpans } from '../test/tracing.js';
import { HTTP_TRACE_OPTIONS } from './tracing.js';

const spans = recordSpans();

function incoming(url: string): IncomingMessage {
  const request = new IncomingMessage(new Socket());
  request.url = url;
  return request;
}

describe('HTTP_TRACE_OPTIONS', () => {
  it.each(['/api/v1/health', '/api/v1/health?full=1', '/metrics'])(
    'starts no server span for %s',
    (url) => {
      expect(HTTP_TRACE_OPTIONS.ignoreIncomingRequestHook?.(incoming(url))).toBe(true);
    },
  );

  it('starts a server span for an api route', () => {
    expect(HTTP_TRACE_OPTIONS.ignoreIncomingRequestHook?.(incoming('/api/v1/applications'))).toBe(
      false,
    );
  });

  it('keeps an OAuth code and state out of the server span query', async () => {
    const span = trace.getTracer('probe').startSpan('GET', {
      kind: SpanKind.SERVER,
      attributes: { 'url.query': 'code=secret-code&state=secret-state' },
    });

    HTTP_TRACE_OPTIONS.requestHook?.(
      span,
      incoming('/api/v1/auth/github/callback?code=secret-code'),
    );
    span.end();

    const [server] = await spans.named('GET');
    expect(server?.attributes['url.query']).toBe('REDACTED');
  });
});
