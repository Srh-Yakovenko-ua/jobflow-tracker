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

function scrollTo(this: Element, options?: ScrollToOptions) {
  const top = Math.max(0, options?.top ?? this.scrollTop);
  if (top === this.scrollTop) return;
  this.scrollTop = top;
  this.dispatchEvent(new Event('scroll'));
}

const ELEMENT_STUBS = {
  hasPointerCapture: () => false,
  setPointerCapture: () => undefined,
  releasePointerCapture: () => undefined,
  scrollIntoView: () => undefined,
  scrollTo,
};

for (const [name, stub] of Object.entries(ELEMENT_STUBS)) {
  if (!(name in Element.prototype)) {
    Object.defineProperty(Element.prototype, name, { value: stub, configurable: true });
  }
}

function insertTextInFocusedField(command: string, ...args: readonly unknown[]): boolean {
  const [, text] = args;
  const field = document.activeElement;
  if (command !== 'insertText' || typeof text !== 'string') return false;
  if (!(field instanceof HTMLTextAreaElement)) return false;
  field.setRangeText(text, field.selectionStart, field.selectionEnd, 'end');
  field.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
  );
  return true;
}

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => null,
  configurable: true,
});

if (!('execCommand' in document)) {
  Object.defineProperty(document, 'execCommand', {
    value: insertTextInFocusedField,
    configurable: true,
  });
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
