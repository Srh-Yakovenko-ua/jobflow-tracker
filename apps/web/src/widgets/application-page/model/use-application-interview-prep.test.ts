import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NEVER_ANSWERS } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { interviewPrepRoutes, NO_INTERVIEW_PREP } from '@/test/interview-prep-fixtures';
import { matchRoute } from '@/test/match-fixtures';
import { renderHookInApp } from '@/test/render-in-app';
import { scheduledEventRoutes } from '@/test/scheduled-event-fixtures';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import { useApplicationInterviewPrep } from './use-application-interview-prep';

describe('useApplicationInterviewPrep', () => {
  it('at screening keeps the section loading while the schedule has not answered', async () => {
    const schedule = scheduledEventRoutes({ list: { reply: NEVER_ANSWERS.reply } });
    server.use(
      meRoute(),
      ...schedule.handlers,
      matchRoute().handler,
      ...interviewPrepRoutes(NO_INTERVIEW_PREP).handlers,
    );
    const { result } = renderHookInApp(() =>
      useApplicationInterviewPrep({ ...ACME_APPLICATION, currentStage: 'screening' }),
    );

    await waitFor(() => {
      expect(result.current.section.response).toEqual(NO_INTERVIEW_PREP);
    });

    expect(result.current.section.load.pending).toBe(true);
    expect(result.current.requestable).toBe(false);
  });
});
