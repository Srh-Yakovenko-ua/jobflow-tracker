import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getQueueToken } from '@nestjs/bullmq';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Queue } from 'bullmq';
import type { Router } from 'express';
import helmet from 'helmet';

import { QUEUE_NAMES } from './queues.js';

export const BULL_BOARD_PATH = '/admin/queues';

const boardHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      fontSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      upgradeInsecureRequests: null,
    },
  },
});

export function mountBullBoard(app: NestExpressApplication): void {
  const serverAdapter = new ExpressAdapter().setBasePath(BULL_BOARD_PATH);
  createBullBoard({
    queues: QUEUE_NAMES.map(
      (name) => new BullMQAdapter(app.get<Queue>(getQueueToken(name)), { readOnlyMode: true }),
    ),
    serverAdapter,
  });
  app.use(BULL_BOARD_PATH, boardHeaders, serverAdapter.getRouter() as Router);
}
