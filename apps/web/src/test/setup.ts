import { cleanup } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { installFakeLockManager } from './fake-lock-manager';
import { releaseHeldLatches } from './latch';
import { resetMediaQueries } from './media-query';
import { server } from './server';

MotionGlobalConfig.skipAnimations = true;

class SilentResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const ELEMENT_STUBS = {
  hasPointerCapture: () => false,
  setPointerCapture: () => undefined,
  releasePointerCapture: () => undefined,
  scrollIntoView: () => undefined,
};

for (const [name, stub] of Object.entries(ELEMENT_STUBS)) {
  if (!(name in Element.prototype)) {
    Object.defineProperty(Element.prototype, name, { value: stub, configurable: true });
  }
}

if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: SilentResizeObserver,
    configurable: true,
  });
}

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
beforeEach(() => {
  installFakeLockManager();
  resetMediaQueries();
});
afterEach(() => {
  cleanup();
  releaseHeldLatches();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});
