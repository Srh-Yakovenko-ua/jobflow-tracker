import type { Logger } from '@nestjs/common';

import { errorMessageOf } from './error-message.js';

export type RequestTotals = { picked: number; requested: number };

export type RequestEachOptions = {
  request: (userId: string) => Promise<boolean>;
  logger: Logger;
  labels: { failed: string; done: string };
};

export async function requestEach(
  userIds: string[],
  { request, logger, labels }: RequestEachOptions,
): Promise<RequestTotals> {
  const totals = { picked: userIds.length, requested: 0 };
  for (const userId of userIds) {
    try {
      totals.requested += Number(await request(userId));
    } catch (error) {
      logger.warn({ userId, err: errorMessageOf(error) }, labels.failed);
    }
  }
  logger.log(totals, labels.done);
  return totals;
}
