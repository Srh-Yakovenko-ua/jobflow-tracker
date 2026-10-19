import type { ErrorResponse } from '@jobflow/shared';

export const ERROR_TYPES = {
  400: { type: 'bad_request', title: 'Bad request' },
  401: { type: 'unauthorized', title: 'Unauthorized' },
  403: { type: 'forbidden', title: 'Forbidden' },
  404: { type: 'not_found', title: 'Not found' },
  409: { type: 'conflict', title: 'Conflict' },
  413: { type: 'payload_too_large', title: 'Payload too large' },
  422: { type: 'validation_error', title: 'Invalid request' },
  429: { type: 'rate_limited', title: 'Too many requests' },
  500: { type: 'internal_error', title: 'Internal error' },
  503: { type: 'not_ready', title: 'Service not ready' },
} as const;

export type ErrorStatus = keyof typeof ERROR_TYPES;

export type ErrorBody = Omit<ErrorResponse, 'requestId'>;

export type FieldError = NonNullable<ErrorBody['errors']>[number];

export type AppErrorOptions = ErrorBody & { cause?: unknown };

export class AppError extends Error {
  readonly body: ErrorBody;

  constructor({ cause, ...body }: AppErrorOptions) {
    super(body.detail ?? body.title, { cause });
    this.name = 'AppError';
    this.body = body;
  }

  get status(): number {
    return this.body.status;
  }
}

export function isErrorStatus(status: number): status is ErrorStatus {
  return Object.hasOwn(ERROR_TYPES, status);
}

export function errorFor(status: ErrorStatus, detail?: string): AppError {
  return new AppError({ status, ...ERROR_TYPES[status], detail });
}

export const notFound = (detail?: string) => errorFor(404, detail);

export const conflict = (detail?: string) => errorFor(409, detail);

export const unauthorized = (detail?: string) => errorFor(401, detail);

export const forbidden = (detail?: string) => errorFor(403, detail);

export const validation = (errors: FieldError[]) =>
  new AppError({ status: 422, ...ERROR_TYPES[422], errors });
