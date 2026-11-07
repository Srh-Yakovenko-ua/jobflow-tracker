import { act } from '@testing-library/react';

import { type ComputedStyle, overrideComputedStyle } from './computed-style';

export type HeldExits = Readonly<{ finish: () => void }>;

const EXIT_ANIMATION = 'exit';

const CLOSED = '[data-state=closed]';

function animationNameOf({ element }: ComputedStyle): string {
  return element.matches(CLOSED) ? EXIT_ANIMATION : 'enter';
}

function exitEnd(): Event {
  const event = new Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: EXIT_ANIMATION });
  return event;
}

export function holdExitAnimations(): HeldExits {
  overrideComputedStyle({ property: 'animationName', valueOf: animationNameOf });
  return {
    finish: () => {
      act(() => {
        for (const node of document.querySelectorAll(CLOSED)) node.dispatchEvent(exitEnd());
      });
    },
  };
}
