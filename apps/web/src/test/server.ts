import { setupServer } from 'msw/node';

import { refusedRefreshRoute } from './api-handlers';

export const server = setupServer(refusedRefreshRoute());
