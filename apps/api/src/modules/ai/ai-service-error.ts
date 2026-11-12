import { ServiceCallError, type ServiceCallFailure } from '../../common/service-call-error.js';

export class AiServiceError extends ServiceCallError {
  constructor(failure: ServiceCallFailure) {
    super(failure, 'AI call');
  }
}
