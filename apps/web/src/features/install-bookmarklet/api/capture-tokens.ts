import {
  type CaptureTokenCreated,
  captureTokenCreatedSchema,
  captureTokenListResponseSchema,
  type CaptureTokenSummary,
} from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { apiClient, ApiError } from '@/shared/api';

import { captureTokenKeys } from '../model/keys';

const TOKENS_PATH = '/capture/tokens';

export function captureTokensQueryOptions() {
  return queryOptions({
    queryKey: captureTokenKeys.list(),
    queryFn: ({ signal }) =>
      apiClient.request({ path: TOKENS_PATH, schema: captureTokenListResponseSchema, signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function createCaptureToken(): Promise<CaptureTokenCreated> {
  return apiClient.request({
    path: TOKENS_PATH,
    method: 'POST',
    schema: captureTokenCreatedSchema,
  });
}

function isAlreadyRevoked(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

async function revokeCaptureToken(id: CaptureTokenSummary['id']): Promise<void> {
  try {
    await apiClient.request({ path: `${TOKENS_PATH}/${id}`, method: 'DELETE', schema: z.void() });
  } catch (error) {
    if (!isAlreadyRevoked(error)) throw error;
  }
}

export async function revokeCaptureTokens(
  ids: readonly CaptureTokenSummary['id'][],
): Promise<void> {
  await Promise.all(ids.map((id) => revokeCaptureToken(id)));
}
