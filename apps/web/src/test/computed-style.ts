import { vi } from 'vitest';

export type ComputedStyle = Readonly<{ element: Element; style: CSSStyleDeclaration }>;

export type ComputedOverride = Readonly<{
  property: keyof CSSStyleDeclaration;
  valueOf: (computed: ComputedStyle) => string;
}>;

function overriddenStyle(computed: ComputedStyle, { property, valueOf }: ComputedOverride) {
  return new Proxy(computed.style, {
    get(target, key) {
      if (key === property) return valueOf(computed);
      const value: unknown = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      const bound: unknown = value.bind(target);
      return bound;
    },
  });
}

export function overrideComputedStyle(override: ComputedOverride): void {
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) =>
    overriddenStyle({ element, style: computed(element, pseudo) }, override),
  );
}
