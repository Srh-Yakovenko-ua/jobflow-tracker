import {
  type ImportApplicationsInput,
  type ImportApplicationsResponse,
  importApplicationsResponseSchema,
} from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export type ImportApplicationsRequest = Readonly<{
  body: ImportApplicationsInput;
  idempotencyKey: string;
}>;

export function importApplications({
  body,
  idempotencyKey,
}: ImportApplicationsRequest): Promise<ImportApplicationsResponse> {
  return apiClient.request({
    path: '/applications/import',
    method: 'POST',
    body,
    idempotencyKey,
    schema: importApplicationsResponseSchema,
  });
}
