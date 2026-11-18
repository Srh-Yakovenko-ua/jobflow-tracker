import { AI_JOB_FAILURES } from '@jobflow/shared';

import { ERROR_TYPES } from '../../common/app-error.js';
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
  unauthorized: ERROR_TYPES[401].type,
  forbidden: ERROR_TYPES[403].type,
  notFound: ERROR_TYPES[404].type,
  validation: ERROR_TYPES[422].type,
  internal: ERROR_TYPES[500].type,
  notImplemented: 'not_implemented',
  unexpectedResponse: SERVICE_CALL_ERRORS.unexpectedResponse,
} as const;

export type AiServiceErrorType = (typeof AI_SERVICE_ERRORS)[keyof typeof AI_SERVICE_ERRORS];

export class AiServiceError extends ServiceCallError {
  readonly reachedService: boolean;

  constructor({ reachedService, ...failure }: ServiceCallFailure & { reachedService?: false }) {
    super(failure, 'AI call');
    this.reachedService = reachedService ?? true;
  }
}

export function untypedAiError(cause: unknown): AiServiceError {
  return new AiServiceError({ status: 500, type: AI_SERVICE_ERRORS.internal, cause });
}
