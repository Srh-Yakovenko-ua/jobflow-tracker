import type { SilenceWindow } from '@jobflow/shared';

import type { Prisma } from '../generated/prisma/client.js';

export function silenceWindowWhere({
  stages,
  lastEventAtOrBefore,
  lastEventAfter,
}: SilenceWindow): Prisma.ApplicationWhereInput {
  return {
    currentStage: { in: [...stages] },
    lastEventAt: {
      ...(lastEventAtOrBefore === undefined ? {} : { lte: lastEventAtOrBefore }),
      ...(lastEventAfter === undefined ? {} : { gt: lastEventAfter }),
    },
  };
}
