import { HttpResponse } from 'msw/http';
import { describe, expect, it } from 'vitest';

import { errorBody } from '@/test/api-handlers';

import { toApiError } from './api-error';

const RATE_LIMITED = errorBody({ status: 429, type: 'rate_limited', title: 'Too many requests' });

function rateLimited(headers: Record<string, string>) {
  return HttpResponse.json(RATE_LIMITED, { status: 429, headers });
}

describe('toApiError', () => {
  it('keeps a DOC-04 body as the API sent it', async () => {
    const body = errorBody({
      status: 422,
      type: 'validation_failed',
      title: 'Validation failed',
      errors: [{ path: 'email', message: 'Invalid email address' }],
    });

    const error = await toApiError(HttpResponse.json(body, { status: 422 }));

    expect(error.body).toEqual({
      status: 422,
      type: 'validation_failed',
      title: 'Validation failed',
      errors: [{ path: 'email', message: 'Invalid email address' }],
      requestId: 'req-test',
    });
    expect(error.status).toBe(422);
  });

  it('reads Retry-After: 30 on a 429 as 30 seconds', async () => {
    const error = await toApiError(rateLimited({ 'Retry-After': '30' }));

    expect(error.retryAfterSeconds).toBe(30);
  });

  it.each([
    ['missing', {}],
    ['an HTTP date', { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' }],
    ['negative', { 'Retry-After': '-5' }],
  ])('leaves retryAfterSeconds undefined when Retry-After is %s', async (_case, headers) => {
    const error = await toApiError(rateLimited(headers));

    expect(error.retryAfterSeconds).toBeUndefined();
  });

  it('falls back to unexpected_response with the x-request-id header for an HTML 502', async () => {
    const response = new Response('<html><body>Bad gateway</body></html>', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'Content-Type': 'text/html', 'x-request-id': 'req-502' },
    });

    const error = await toApiError(response);

    expect(error.body).toEqual({
      type: 'unexpected_response',
      title: 'Bad Gateway',
      status: 502,
      requestId: 'req-502',
    });
  });

  it('names the request id none when an empty failure carries no x-request-id', async () => {
    const error = await toApiError(new Response(null, { status: 503 }));

    expect(error.body).toEqual({
      type: 'unexpected_response',
      title: 'Unexpected response',
      status: 503,
      requestId: 'none',
    });
  });
});
