import { z } from 'zod';

import { logger } from '@/shared/lib/logger';

export type ParseResponseOptions<T> = {
  schema: z.ZodType<T>;
  body: unknown;
  request: { method: string; path: string };
};

export function parseResponse<T>({ schema, body, request }: ParseResponseOptions<T>): T {
  const result = schema.safeParse(body);
  if (result.success) {
    return result.data;
  }
  logger.error(
    { ...request, issues: z.prettifyError(result.error) },
    'API response does not match its schema',
  );
  throw result.error;
}
