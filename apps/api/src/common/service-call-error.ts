import { AI_JOB_FAILURES, errorResponseSchema } from '@jobflow/shared';

export type ServiceCallFailure = { status: number; type: string; cause?: unknown };

type ServiceCallErrorClass = new (failure: ServiceCallFailure) => ServiceCallError;

type FetchFailure = { timeoutType: string; ErrorClass: ServiceCallErrorClass };

export const SERVICE_CALL_ERRORS = {
  notReady: AI_JOB_FAILURES.notReady,
  unexpectedResponse: 'unexpected_response',
} as const;

export class ServiceCallError extends Error {
  readonly status: number;

  readonly type: string;

  constructor({ status, type, cause }: ServiceCallFailure, call: string) {
    super(`${call} failed: ${String(status)} ${type}`, { cause });
    this.name = new.target.name;
    this.status = status;
    this.type = type;
  }
}

export async function refusalTypeOf(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => undefined);
  return errorResponseSchema.safeParse(body).data?.type ?? SERVICE_CALL_ERRORS.unexpectedResponse;
}

export function fetchFailureOf(error: unknown, { timeoutType, ErrorClass }: FetchFailure): unknown {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return new ErrorClass({ status: 504, type: timeoutType, cause: error });
  }
  return error instanceof TypeError
    ? new ErrorClass({ status: 503, type: SERVICE_CALL_ERRORS.notReady, cause: error })
    : error;
}
