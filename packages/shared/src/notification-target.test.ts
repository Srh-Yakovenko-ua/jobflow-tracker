import { describe, expect, it } from 'vitest';

import { longestSilentItemOf, notificationTargetOf } from './notification-target.js';
import type { Notification } from './notifications.js';
import {
  AI_DONE,
  APPLICATION_ID,
  EXPORT_READY,
  INTERVIEW_PREP_READY,
  INTERVIEW_SOON,
  MONTHLY_SUMMARY_READY,
  NOTIFICATION_ROW,
  SILENCE,
  SILENCE_ITEM,
} from './test/notification-fixtures.js';

const LONGEST_SILENT_ID = '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e30';

const JOB_ID = AI_DONE.aiJobId;

describe('notificationTargetOf', () => {
  it.each<{ name: string; notification: Notification; target: string | null }>([
    {
      name: 'silence opens the follow-up of the longest silent card',
      notification: {
        ...NOTIFICATION_ROW,
        type: 'silence',
        payload: {
          items: [SILENCE_ITEM, { ...SILENCE_ITEM, applicationId: LONGEST_SILENT_ID, days: 9 }],
        },
      },
      target: `/applications/${LONGEST_SILENT_ID}#follow-up`,
    },
    {
      name: 'interview_soon opens the card',
      notification: { ...NOTIFICATION_ROW, type: 'interview_soon', payload: INTERVIEW_SOON },
      target: `/applications/${APPLICATION_ID}`,
    },
    {
      name: 'ai_done for a vacancy opens its review',
      notification: { ...NOTIFICATION_ROW, type: 'ai_done', payload: AI_DONE },
      target: `/add?review=${APPLICATION_ID}&job=${JOB_ID}#review`,
    },
    {
      name: 'ai_failed for a vacancy without a card leads nowhere',
      notification: {
        ...NOTIFICATION_ROW,
        type: 'ai_failed',
        payload: { aiJobId: JOB_ID, kind: 'vacancy_parse', errorType: 'timeout' },
      },
      target: null,
    },
    {
      name: 'ai_done for a resume opens the resumes',
      notification: {
        ...NOTIFICATION_ROW,
        type: 'ai_done',
        payload: { aiJobId: JOB_ID, kind: 'resume_parse' },
      },
      target: '/resumes',
    },
    {
      name: 'ai_done for a follow-up opens the follow-up block',
      notification: {
        ...NOTIFICATION_ROW,
        type: 'ai_done',
        payload: { ...AI_DONE, kind: 'followup' },
      },
      target: `/applications/${APPLICATION_ID}#follow-up`,
    },
    {
      name: 'ai_done for a follow-up without a card leads nowhere',
      notification: {
        ...NOTIFICATION_ROW,
        type: 'ai_done',
        payload: { aiJobId: JOB_ID, kind: 'followup' },
      },
      target: null,
    },
    {
      name: 'insight_unlocked opens the analytics',
      notification: {
        ...NOTIFICATION_ROW,
        type: 'insight_unlocked',
        payload: { applications: 10 },
      },
      target: '/analytics',
    },
    {
      name: 'monthly_summary_ready opens the summary of its month',
      notification: {
        ...NOTIFICATION_ROW,
        type: 'monthly_summary_ready',
        payload: MONTHLY_SUMMARY_READY,
      },
      target: '/analytics/summary/2026-08',
    },
    {
      name: 'auto_ghosted opens the board',
      notification: {
        ...NOTIFICATION_ROW,
        type: 'auto_ghosted',
        payload: { ...SILENCE, autoGhostDays: 30 },
      },
      target: '/board',
    },
    {
      name: 'export_ready opens the account settings with its export',
      notification: { ...NOTIFICATION_ROW, type: 'export_ready', payload: EXPORT_READY },
      target: '/settings?export=0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e24#account',
    },
    {
      name: 'interview_prep_ready opens the card holding the pack',
      notification: {
        ...NOTIFICATION_ROW,
        type: 'interview_prep_ready',
        payload: INTERVIEW_PREP_READY,
      },
      target: `/applications/${APPLICATION_ID}`,
    },
  ])('$name', ({ notification, target }) => {
    expect(notificationTargetOf(notification)).toBe(target);
  });
});

describe('longestSilentItemOf', () => {
  it('picks the application silent for the most days', () => {
    const longest = { ...SILENCE_ITEM, applicationId: LONGEST_SILENT_ID, days: 9 };
    expect(longestSilentItemOf({ items: [SILENCE_ITEM, longest, SILENCE_ITEM] })).toEqual(longest);
  });

  it('finds nothing in an empty reminder', () => {
    expect(longestSilentItemOf({ items: [] })).toBeUndefined();
  });
});
