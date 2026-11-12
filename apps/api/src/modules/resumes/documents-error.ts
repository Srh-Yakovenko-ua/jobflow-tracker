import { ServiceCallError, type ServiceCallFailure } from '../../common/service-call-error.js';

export const DOCUMENTS_ERRORS = { timeout: 'documents_timeout' } as const;

export class DocumentsError extends ServiceCallError {
  constructor(failure: ServiceCallFailure) {
    super(failure, 'Document extraction');
  }
}
