import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw/http';
import { describe, expect, it } from 'vitest';

import { apiUrl } from '@/test/api-handlers';
import { server } from '@/test/server';

import { applicationAiQueryOptions, fetchApplicationAi } from './application-ai';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

const QUEUED = { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', status: 'queued', errorType: null };

function routeAnswering(segment: string, body: object) {
  server.use(http.get(apiUrl(`/applications/${ID}/${segment}`), () => HttpResponse.json(body)));
}

describe('applicationAiQueryOptions', () => {
  it('keeps each AI section under the application detail key, named by its segment', () => {
    expect(applicationAiQueryOptions({ id: ID, segment: 'interview-prep' }).queryKey).toEqual([
      'applications',
      'detail',
      ID,
      'interview-prep',
    ]);
  });

  it('reads the section from its own path', async () => {
    routeAnswering('cv-hints', { result: null, job: QUEUED });
    const { queryKey, queryFn } = applicationAiQueryOptions({ id: ID, segment: 'cv-hints' });
    if (queryFn === undefined) throw new Error('the cv hints query has no queryFn');

    const response = await queryFn({
      client: new QueryClient(),
      queryKey,
      signal: new AbortController().signal,
      meta: undefined,
    });

    expect(response).toEqual({ result: null, job: QUEUED });
  });

  it("refuses an answer that is not the segment's shape", async () => {
    routeAnswering('match', { result: null, job: QUEUED });

    await expect(
      fetchApplicationAi({ id: ID, segment: 'match' }, new AbortController().signal),
    ).rejects.toThrow();
  });
});
