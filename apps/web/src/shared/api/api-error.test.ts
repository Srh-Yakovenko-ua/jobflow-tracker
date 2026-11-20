import { HttpResponse } from 'msw/http';
import { describe, expect, it } from 'vitest';

import { apiErrorOf, errorBody, rateLimitedReply, STILL_RUNNING } from '@/test/api-handlers';

import {
  apiStatusOf,
  HTTP_STATUS,
  isIdempotencyConflict,
  isNotFound,
  toApiError,
} from './api-error';

const NOT_FOUND = apiErrorOf({ status: 404, type: 'not_found' });

describe('apiStatusOf', () => {
  it('reads the status the API answered with', () => {
    expect(apiStatusOf(NOT_FOUND)).toBe(404);
  });

  it.each([
    ['a network failure', new TypeError('Failed to fetch')],
    ['a thrown string', 'offline'],
    ['nothing', undefined],
  ])('has no status for %s', (_case, error) => {
    expect(apiStatusOf(error)).toBeUndefined();
  });

  it('a missing record is not found, a network failure is not', () => {
    expect(isNotFound(NOT_FOUND)).toBe(true);
    expect(isNotFound(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('only a 409 of the idempotency type is a request still running', () => {
    const busy = apiErrorOf(STILL_RUNNING);
    const stale = apiErrorOf({ status: HTTP_STATUS.conflict, type: 'conflict' });

    expect(isIdempotencyConflict(busy)).toBe(true);
    expect(isIdempotencyConflict(stale)).toBe(false);
    expect(isIdempotencyConflict('offline')).toBe(false);
  });
});

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
    const error = await toApiError(rateLimitedReply({ 'Retry-After': '30' }));

    expect(error.retryAfterSeconds).toBe(30);
  });

  it.each([
    ['missing', {}],
    ['an HTTP date', { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' }],
    ['negative', { 'Retry-After': '-5' }],
  ])('leaves retryAfterSeconds undefined when Retry-After is %s', async (_case, headers) => {
    const error = await toApiError(rateLimitedReply(headers));

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
