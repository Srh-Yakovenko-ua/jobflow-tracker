import type { ClientRect } from '@dnd-kit/core';

export function centreOf(rect: ClientRect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
