import { vi } from 'vitest';

import { logger } from '@/shared/lib/logger';

export function refuseStorage() {
  const refuse = () => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(refuse);
  return vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
}
