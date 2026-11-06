import type { NestExpressApplication } from '@nestjs/platform-express';

import type { ApplicationRequest } from './applications.js';
import { callRoute } from './http.js';

export const SEARCHES_PATH = '/api/v1/searches';

export const FINISH_SEARCH_PATH = `${SEARCHES_PATH}/current/finish`;

export function finishSearch(
  app: NestExpressApplication,
  { accessToken, input }: ApplicationRequest<object>,
) {
  return callRoute(app, { method: 'post', path: FINISH_SEARCH_PATH, body: input, accessToken });
}
