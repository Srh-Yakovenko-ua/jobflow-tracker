import { describe, expect, it } from 'vitest';

import { fixtureIdOf } from '@/test/board-fixtures';
import {
  AI_DONE_NOTIFICATION,
  buildNotification,
  INTERVIEW_NOTIFICATION,
  MONTHLY_SUMMARY_NOTIFICATION,
  type NotificationSeed,
  SILENCE_NOTIFICATION,
} from '@/test/notification-fixtures';

import { notificationTargetOf } from './notification-target';

const APPLICATION_ID = fixtureIdOf(32);

const JOB_ID = fixtureIdOf(31);

function aiSeed(seed: Pick<NotificationSeed, 'type' | 'payload'>): NotificationSeed {
  return { serial: 9, ...seed };
}

describe('notificationTargetOf', () => {
  it.each([
    {
      name: 'silence opens the follow-up block of the longest silent card',
      notification: SILENCE_NOTIFICATION,
      target: `/applications/${fixtureIdOf(12)}#follow-up`,
    },
    {
      name: 'interview_soon opens the card',
      notification: INTERVIEW_NOTIFICATION,
      target: `/applications/${fixtureIdOf(21)}`,
    },
    {
      name: 'ai_done for a vacancy opens the review of the finished job',
      notification: AI_DONE_NOTIFICATION,
      target: `/add?review=${APPLICATION_ID}&job=${JOB_ID}#review`,
    },
    {
      name: 'ai_failed for a vacancy opens the same review',
      notification: buildNotification(
        aiSeed({
          type: 'ai_failed',
          payload: {
            aiJobId: JOB_ID,
            kind: 'vacancy_parse',
            applicationId: APPLICATION_ID,
            errorType: 'timeout',
          },
        }),
      ),
      target: `/add?review=${APPLICATION_ID}&job=${JOB_ID}#review`,
    },
    {
      name: 'ai_done for a resume opens the resumes',
      notification: buildNotification(
        aiSeed({ type: 'ai_done', payload: { aiJobId: JOB_ID, kind: 'resume_parse' } }),
      ),
      target: '/resumes',
    },
    {
      name: 'ai_done for a follow-up opens the follow-up block',
      notification: buildNotification(
        aiSeed({
          type: 'ai_done',
          payload: { aiJobId: JOB_ID, kind: 'followup', applicationId: APPLICATION_ID },
        }),
      ),
      target: `/applications/${APPLICATION_ID}#follow-up`,
    },
    {
      name: 'ai_done for a vacancy with no application leads nowhere',
      notification: buildNotification(
        aiSeed({ type: 'ai_done', payload: { aiJobId: JOB_ID, kind: 'vacancy_parse' } }),
      ),
      target: null,
    },
    {
      name: 'ai_failed for a follow-up with no application leads nowhere',
      notification: buildNotification(
        aiSeed({
          type: 'ai_failed',
          payload: { aiJobId: JOB_ID, kind: 'followup', errorType: 'timeout' },
        }),
      ),
      target: null,
    },
    {
      name: 'insight_unlocked opens the analytics',
      notification: buildNotification({
        serial: 10,
        type: 'insight_unlocked',
        payload: { applications: 10 },
      }),
      target: '/analytics',
    },
    {
      name: 'monthly_summary_ready opens the summary page of its month',
      notification: MONTHLY_SUMMARY_NOTIFICATION,
      target: '/analytics/summary/2026-10',
    },
  ])('$name', ({ notification, target }) => {
    expect(notificationTargetOf(notification)).toBe(target);
  });
});
