import type { ClientRect, KeyboardCoordinateGetter, SensorContext } from '@dnd-kit/core';

import { centreOf } from './rect-centre';

type Direction = -1 | 1;

type Step = Readonly<{ context: SensorContext; direction: Direction; from: number }>;

const ARROW_STEP: Readonly<Record<string, Direction | 0>> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowUp: 0,
  ArrowDown: 0,
};

function nearestColumn({ context, direction, from }: Step): ClientRect | undefined {
  const { droppableContainers, droppableRects } = context;
  return droppableContainers
    .getEnabled()
    .flatMap((container) => droppableRects.get(container.id) ?? [])
    .filter((column) => direction * (centreOf(column).x - from) > 0)
    .sort((left, right) => direction * (left.left - right.left))[0];
}

export const columnCoordinates: KeyboardCoordinateGetter = (
  event,
  { context, currentCoordinates },
) => {
  const step = ARROW_STEP[event.code];
  if (step === undefined) return undefined;
  event.preventDefault();
  const { collisionRect } = context;
  if (step === 0 || collisionRect === null) return undefined;
  const from = centreOf(collisionRect).x;
  const target = nearestColumn({ context, direction: step, from });
  if (target === undefined) return undefined;
  return { x: centreOf(target).x - collisionRect.width / 2, y: currentCoordinates.y };
};
