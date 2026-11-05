import { vi } from 'vitest';

export function fakeTimeouts() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
}
