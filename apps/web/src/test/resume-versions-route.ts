import type { ResumeVersion, ResumeVersionListResponse } from '@jobflow/shared';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';

export const VERSIONS_PATH = '/resumes/versions';

export function resumeVersionsRoute(items: readonly ResumeVersion[] | HttpResponseResolver = []) {
  const reply =
    typeof items === 'function'
      ? items
      : () => HttpResponse.json({ items: [...items] } satisfies ResumeVersionListResponse);
  return http.get(apiUrl(VERSIONS_PATH), reply);
}
