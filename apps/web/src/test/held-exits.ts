import { act } from '@testing-library/react';
import { vi } from 'vitest';

export type HeldExits = Readonly<{ finish: () => void }>;

type HeldStyle = Readonly<{ element: Element; style: CSSStyleDeclaration }>;

const EXIT_ANIMATION = 'exit';

const CLOSED = '[data-state=closed]';

function animationNameOf(element: Element): string {
  return element.matches(CLOSED) ? EXIT_ANIMATION : 'enter';
}

function heldStyle({ element, style }: HeldStyle): CSSStyleDeclaration {
  return new Proxy(style, {
    get(target, key) {
      if (key === 'animationName') return animationNameOf(element);
      const value: unknown = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      const bound: unknown = value.bind(target);
      return bound;
    },
  });
}

function exitEnd(): Event {
  const event = new Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: EXIT_ANIMATION });
  return event;
}

export function holdExitAnimations(): HeldExits {
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) =>
    heldStyle({ element, style: computed(element, pseudo) }),
  );
  return {
    finish: () => {
      act(() => {
        for (const node of document.querySelectorAll(CLOSED)) node.dispatchEvent(exitEnd());
      });
    },
  };
}
