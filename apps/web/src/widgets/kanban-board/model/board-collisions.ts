import { type CollisionDetection, pointerWithin } from '@dnd-kit/core';

import { centreOf } from './rect-centre';

export const boardCollisions: CollisionDetection = (args) =>
  pointerWithin({
    ...args,
    pointerCoordinates: args.pointerCoordinates ?? centreOf(args.collisionRect),
  });
