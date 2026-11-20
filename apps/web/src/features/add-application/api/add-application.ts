import { capturePasteResponseSchema, createApplicationResponseSchema } from '@jobflow/shared';
import type { z } from 'zod';

import { apiClient } from '@/shared/api';

export type AddEndpoint<Result> = Readonly<{ path: string; schema: z.ZodType<Result> }>;

export const ADD_ENDPOINTS = {
  paste: { path: '/capture/paste', schema: capturePasteResponseSchema },
  manual: { path: '/applications', schema: createApplicationResponseSchema },
} as const;

export type PostAdditionRequest<Body, Result> = Readonly<{
  endpoint: AddEndpoint<Result>;
  body: Body;
  idempotencyKey: string;
}>;

export function postAddition<Body, Result>({
  endpoint,
  body,
  idempotencyKey,
}: PostAdditionRequest<Body, Result>): Promise<Result> {
  return apiClient.request({
    path: endpoint.path,
    method: 'POST',
    body,
    schema: endpoint.schema,
    idempotencyKey,
  });
}
