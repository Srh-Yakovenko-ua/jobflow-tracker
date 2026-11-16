import { AI_JOB_FAILURES } from '@jobflow/shared';

import {
  SERVICE_CALL_ERRORS,
  ServiceCallError,
  type ServiceCallFailure,
} from '../../common/service-call-error.js';

export const AI_SERVICE_ERRORS = {
  timeout: AI_JOB_FAILURES.timeout,
  invalidOutput: AI_JOB_FAILURES.invalidOutput,
  notReady: AI_JOB_FAILURES.notReady,
  providerError: AI_JOB_FAILURES.providerError,
  rateLimited: AI_JOB_FAILURES.rateLimited,
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  notFound: 'not_found',
  validation: 'validation_error',
  internal: 'internal_error',
  notImplemented: 'not_implemented',
  unexpectedResponse: SERVICE_CALL_ERRORS.unexpectedResponse,
} as const;

export type AiServiceErrorType = (typeof AI_SERVICE_ERRORS)[keyof typeof AI_SERVICE_ERRORS];

export class AiServiceError extends ServiceCallError {
  constructor(failure: ServiceCallFailure) {
    super(failure, 'AI call');
  }
}

export function untypedAiError(cause: unknown): AiServiceError {
  return new AiServiceError({ status: 500, type: AI_SERVICE_ERRORS.internal, cause });
}
