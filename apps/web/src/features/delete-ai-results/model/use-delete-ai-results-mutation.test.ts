import { describe, expect, it } from 'vitest';

import { applicationKeys } from '@/entities/application';
import { resumeKeys } from '@/entities/resume';
import { userKeys } from '@/entities/user';
import { deleteAiResultsRoute } from '@/test/ai-results-fixtures';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { server } from '@/test/server';
import { ME_RESPONSE } from '@/test/session-fixtures';
import { settleMutation } from '@/test/settle-mutation';

import { useDeleteAiResultsMutation } from './use-delete-ai-results-mutation';

const CACHED = [
  { queryKey: applicationKeys.detail(ACME_APPLICATION.id), data: ACME_APPLICATION },
  { queryKey: resumeKeys.list(), data: [] },
  { queryKey: userKeys.me(), data: ME_RESPONSE },
];

describe('useDeleteAiResultsMutation', () => {
  it('sends one DELETE and marks the applications and the resumes stale, so scores and profiles load again', async () => {
    const route = deleteAiResultsRoute();
    server.use(route.handler);

    const { status, invalidated } = await settleMutation({
      useMutation: useDeleteAiResultsMutation,
      cached: CACHED,
    });

    expect(status).toBe('success');
    expect(route.sent).toEqual(['DELETE']);
    expect(invalidated).toEqual([true, true, false]);
  });
});
