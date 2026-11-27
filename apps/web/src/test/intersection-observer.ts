import { act } from '@testing-library/react';

const observers = new Set<FakeIntersectionObserver>();

function entryOf(target: Element, inBand: Element | null): IntersectionObserverEntry {
  const rect = target.getBoundingClientRect();
  const isIntersecting = target === inBand;
  return {
    target,
    isIntersecting,
    intersectionRatio: isIntersecting ? 1 : 0,
    boundingClientRect: rect,
    intersectionRect: rect,
    rootBounds: null,
    time: 0,
  };
}

class FakeIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin: string;
  readonly scrollMargin = '0px';
  readonly thresholds: readonly number[] = [0];
  readonly #callback: IntersectionObserverCallback;
  readonly #targets = new Set<Element>();

  constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
    this.#callback = callback;
    this.rootMargin = options.rootMargin ?? '0px';
  }

  observe(target: Element): void {
    this.#targets.add(target);
    observers.add(this);
  }

  unobserve(target: Element): void {
    this.#targets.delete(target);
  }

  disconnect(): void {
    this.#targets.clear();
    observers.delete(this);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  report(inBand: Element | null): void {
    const entries = [...this.#targets].map((target) => entryOf(target, inBand));
    if (entries.length > 0) this.#callback(entries, this);
  }
}

export function installFakeIntersectionObserver() {
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    value: FakeIntersectionObserver,
    configurable: true,
    writable: true,
  });
}

export function scrollIntoBand(element: Element | null) {
  act(() => {
    for (const observer of observers) observer.report(element);
  });
}
