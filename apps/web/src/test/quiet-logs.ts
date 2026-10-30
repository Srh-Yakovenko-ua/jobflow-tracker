import { vi } from 'vitest';

import { logger } from '@/shared/lib/logger';

export function quietLogs() {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return vi.spyOn(logger, 'error').mockImplementation(() => undefined);
}
