import { setupServer } from 'msw/node';

import { refusedRefreshRoute } from './api-handlers';
import { normsRoute } from './norms-fixtures';
import { oauthProvidersRoute } from './session-fixtures';

export const server = setupServer(refusedRefreshRoute(), oauthProvidersRoute(), normsRoute());
