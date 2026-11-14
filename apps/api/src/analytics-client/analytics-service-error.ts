import { ServiceCallError, type ServiceCallFailure } from '../common/service-call-error.js';

export const ANALYTICS_ERRORS = { timeout: 'analytics_timeout' } as const;

export class AnalyticsServiceError extends ServiceCallError {
  constructor(failure: ServiceCallFailure) {
    super(failure, 'Analytics call');
  }
}
