import { addMinutes, subMinutes } from 'date-fns';

import { INTERVIEW_PREP_LEAD_MIN } from '../interview-prep/index.js';

const INTERVIEW_ALERT_LEAD_MIN = 120;

export const INTERVIEW_REMINDER_LEADS_MIN = [
  INTERVIEW_PREP_LEAD_MIN,
  INTERVIEW_ALERT_LEAD_MIN,
  15,
] as const;

export function nextInterviewReminderAt(startsAt: Date, now: Date): Date | null {
  const marks = INTERVIEW_REMINDER_LEADS_MIN.map((lead) => subMinutes(startsAt, lead));
  return marks.find((mark) => mark > now) ?? null;
}

export const isInterviewPrepMark = (startsAt: Date, now: Date): boolean =>
  startsAt > addMinutes(now, INTERVIEW_ALERT_LEAD_MIN);
