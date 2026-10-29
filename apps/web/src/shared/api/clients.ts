import { config } from '@/shared/config';

import { createHttpClient } from './http-client';

export const apiClient = createHttpClient({ baseUrl: config.apiBaseUrl, credentials: 'include' });

export const analyticsClient = createHttpClient({
  baseUrl: config.analyticsBaseUrl,
  credentials: 'omit',
});
