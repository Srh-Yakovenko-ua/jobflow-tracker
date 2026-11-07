import { onTestFinished, vi } from 'vitest';

import { type ComputedStyle, overrideComputedStyle } from './computed-style';
import { fakeAnimation } from './fake-animation';

const DECLARED_TRANSFORM =
  /^translate3d\((-?[\d.]+)px, (-?[\d.]+)px, 0\) scaleX\((-?[\d.]+)\) scaleY\((-?[\d.]+)\)$/;

function resolvedTransform({ style }: ComputedStyle): string {
  const declared = DECLARED_TRANSFORM.exec(style.transform);
  if (declared === null) return style.transform;
  const [, x = '0', y = '0', scaleX = '1', scaleY = '1'] = declared;
  return `matrix(${scaleX}, 0, 0, ${scaleY}, ${x}, ${y})`;
}

function timedAnimation(keyframes: Keyframe[], { duration }: KeyframeAnimationOptions) {
  const animation = fakeAnimation({ running: true });
  setTimeout(animation.finish, Number(duration));
  return animation;
}

export function stubOverlayGlide() {
  overrideComputedStyle({ property: 'transform', valueOf: resolvedTransform });
  const animate = vi.fn(timedAnimation);
  Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
  onTestFinished(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  });
  return animate;
}
