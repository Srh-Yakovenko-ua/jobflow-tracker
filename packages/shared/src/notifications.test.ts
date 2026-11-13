import { describe, expect, it } from 'vitest';

import {
  type InterviewSoonNotificationPayload,
  interviewSoonNotificationPayloadSchema,
  type SilenceNotificationPayload,
  silenceNotificationPayloadSchema,
} from './notifications.js';
import { issuePathsOf } from './test/zod-issues.js';

const SILENCE: SilenceNotificationPayload = {
  applicationId: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e1f',
  company: 'Acme',
  days: 4,
};

const INTERVIEW_SOON: InterviewSoonNotificationPayload = {
  applicationId: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e1f',
  scheduledEventId: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e20',
  company: 'Acme',
  startsAt: '2026-11-03T14:00:00.000Z',
  minutesBefore: 120,
};

describe('notification payloads', () => {
  it('keeps a silence payload as sent', () => {
    expect(silenceNotificationPayloadSchema.parse(SILENCE)).toStrictEqual(SILENCE);
  });

  it('keeps an interview soon payload as sent', () => {
    expect(interviewSoonNotificationPayloadSchema.parse(INTERVIEW_SOON)).toStrictEqual(
      INTERVIEW_SOON,
    );
  });

  it('refuses a silence payload with a fractional day count', () => {
    expect(
      issuePathsOf(silenceNotificationPayloadSchema.safeParse({ ...SILENCE, days: 4.5 })),
    ).toEqual(['days']);
  });

  it('refuses an interview soon payload without a lead time', () => {
    const withoutLead = { ...INTERVIEW_SOON, minutesBefore: undefined };
    expect(issuePathsOf(interviewSoonNotificationPayloadSchema.safeParse(withoutLead))).toEqual([
      'minutesBefore',
    ]);
  });
});
