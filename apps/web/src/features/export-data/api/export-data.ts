import {
  type ExportAccepted,
  exportAcceptedSchema,
  type ExportLink,
  exportLinkSchema,
  type ExportRequest,
} from '@jobflow/shared';
import { queryOptions, skipToken } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { exportKeys } from '../model/keys';

export const EXPORT_DATA_LIMITS = { pollMs: 2_000 } as const;

export type RequestExportInput = Readonly<{ body: ExportRequest; idempotencyKey: string }>;

export function requestExport({
  body,
  idempotencyKey,
}: RequestExportInput): Promise<ExportAccepted> {
  return apiClient.request({
    path: '/me/export',
    method: 'POST',
    body,
    idempotencyKey,
    schema: exportAcceptedSchema,
  });
}

function exportLinkOf(exportId: string, signal: AbortSignal): Promise<ExportLink> {
  return apiClient.request({ path: `/me/exports/${exportId}`, schema: exportLinkSchema, signal });
}

export function exportLinkQueryOptions(exportId: string | null) {
  return queryOptions({
    queryKey: exportKeys.link(exportId),
    queryFn: exportId === null ? skipToken : ({ signal }) => exportLinkOf(exportId, signal),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: ({ state }) =>
      state.data?.status === 'pending' ? EXPORT_DATA_LIMITS.pollMs : false,
  });
}
