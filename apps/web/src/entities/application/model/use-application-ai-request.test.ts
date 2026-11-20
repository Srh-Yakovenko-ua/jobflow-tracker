import { describe, expect, it } from 'vitest';

import { ACME_APPLICATION } from '@/test/application-fixtures';
import { cvHintsRoutes, NO_CV_HINTS } from '@/test/cv-hints-fixtures';
import { interviewPrepRoutes, NO_INTERVIEW_PREP } from '@/test/interview-prep-fixtures';
import { server } from '@/test/server';
import { settleMutation } from '@/test/settle-mutation';

import { applicationKeys } from './keys';
import { useApplicationAiRequest } from './use-application-ai-request';

const ID = ACME_APPLICATION.id;

const CACHED = [
  { queryKey: applicationKeys.ai(ID, 'cv-hints'), data: NO_CV_HINTS },
  { queryKey: applicationKeys.ai(ID, 'interview-prep'), data: NO_INTERVIEW_PREP },
];

const REQUESTS = [
  { segment: 'cv-hints', routes: cvHintsRoutes(), stale: [true, false] },
  { segment: 'interview-prep', routes: interviewPrepRoutes(), stale: [false, true] },
] as const;

describe('useApplicationAiRequest', () => {
  it.each(REQUESTS)(
    'posts one $segment request for the application and marks only its own result stale',
    async ({ segment, routes, stale }) => {
      server.use(...routes.handlers);

      const { status, invalidated } = await settleMutation({
        useMutation: () => useApplicationAiRequest({ applicationId: ID, segment }),
        cached: CACHED,
      });

      expect(status).toBe('success');
      expect(routes.requested).toEqual([ID]);
      expect(invalidated).toEqual(stale);
    },
  );
});
