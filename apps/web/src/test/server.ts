import { setupServer } from 'msw/node';

import { refusedRefreshRoute } from './api-handlers';
import { normsRoute } from './norms-fixtures';
import { resumeVersionsRoute } from './resume-versions-route';
import { oauthProvidersRoute } from './session-fixtures';

export const server = setupServer(
  refusedRefreshRoute(),
  oauthProvidersRoute(),
  normsRoute(),
  resumeVersionsRoute(),
);
