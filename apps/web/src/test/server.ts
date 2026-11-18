import { setupServer } from 'msw/node';

import { refusedRefreshRoute } from './api-handlers';
import { normsRoute } from './norms-fixtures';
import { resumeAbRoute } from './resume-ab-route';
import { resumeVersionsRoute } from './resume-versions-route';
import { rhythmRoute } from './rhythm-fixtures';
import { oauthProvidersRoute } from './session-fixtures';

export const server = setupServer(
  refusedRefreshRoute(),
  oauthProvidersRoute(),
  normsRoute(),
  resumeAbRoute(),
  resumeVersionsRoute(),
  rhythmRoute(),
);
