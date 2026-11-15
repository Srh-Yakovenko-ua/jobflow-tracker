import type { z } from 'zod';

import { logger } from './logger';

export function readStoredJson<Schema extends z.ZodType>(
  key: string,
  schema: Schema,
): z.output<Schema> | undefined {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return undefined;
    const parsed = schema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : undefined;
  } catch (error) {
    logger.warn({ err: error }, 'stored value unreadable');
    return undefined;
  }
}

export function writeStoredJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    logger.warn({ err: error }, 'value not stored');
  }
}
