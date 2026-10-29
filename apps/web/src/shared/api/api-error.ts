import { type ErrorResponse, errorResponseSchema } from '@jobflow/shared';

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
