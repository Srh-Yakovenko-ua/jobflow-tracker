import { z } from 'zod';

const periodSchema = z.uuid();

export function searchPeriodOf(value: unknown): string | undefined {
  const parsed = periodSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export const dashboardHrefOf = (searchId: string) => `/analytics?period=${searchId}`;
