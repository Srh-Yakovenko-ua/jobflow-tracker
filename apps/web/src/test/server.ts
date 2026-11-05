import { setupServer } from 'msw/node';

import { refusedRefreshRoute } from './api-handlers';
import { oauthProvidersRoute } from './session-fixtures';

export const server = setupServer(refusedRefreshRoute(), oauthProvidersRoute());
