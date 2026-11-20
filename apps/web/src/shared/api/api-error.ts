import {
  type ErrorResponse,
  errorResponseSchema,
  IDEMPOTENCY_CONFLICT_TYPE,
} from '@jobflow/shared';

import { readJsonBody } from './read-json-body';

export type ApiErrorOptions = {
  body: ErrorResponse;
  retryAfterSeconds: number | undefined;
};

export class ApiError extends Error {
  readonly body: ErrorResponse;
  readonly retryAfterSeconds: number | undefined;

  constructor({ body, retryAfterSeconds }: ApiErrorOptions) {
    super(body.detail ?? body.title);
    this.name = 'ApiError';
    this.body = body;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  get status(): number {
    return this.body.status;
  }
}

export const HTTP_STATUS = {
  unauthorized: 401,
  notFound: 404,
  conflict: 409,
  unprocessable: 422,
  tooManyRequests: 429,
} as const;

export function apiStatusOf(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

export function isIdempotencyConflict(error: unknown): boolean {
  return (
    apiStatusOf(error) === HTTP_STATUS.conflict &&
    error instanceof ApiError &&
    error.body.type === IDEMPOTENCY_CONFLICT_TYPE
  );
}

const TRANSIENT_ERROR_NAMES = new Set(['TypeError', 'TimeoutError']);

export function isTransient(error: Error): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500;
  }
  return TRANSIENT_ERROR_NAMES.has(error.name);
}

export function isNotFound(error: unknown): boolean {
  return apiStatusOf(error) === HTTP_STATUS.notFound;
}

function fallbackBody(response: Response): ErrorResponse {
  return {
    type: 'unexpected_response',
    title: response.statusText || 'Unexpected response',
    status: response.status,
    requestId: response.headers.get('x-request-id') ?? 'none',
  };
}

const WHOLE_SECONDS = /^\d+$/;

function readRetryAfter(headers: Headers): number | undefined {
  const value = headers.get('retry-after')?.trim();
  return value !== undefined && WHOLE_SECONDS.test(value) ? Number(value) : undefined;
}

export async function toApiError(response: Response): Promise<ApiError> {
  const parsed = errorResponseSchema.safeParse(await readJsonBody(response));
  return new ApiError({
    body: parsed.success ? parsed.data : fallbackBody(response),
    retryAfterSeconds: readRetryAfter(response.headers),
  });
}
