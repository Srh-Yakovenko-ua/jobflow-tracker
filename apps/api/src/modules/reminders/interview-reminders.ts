import { addMinutes } from '../../common/add-minutes.js';

export const INTERVIEW_REMINDER_LEADS_MIN = [120, 15] as const;

export function nextInterviewReminderAt(startsAt: Date, now: Date): Date | null {
  const marks = INTERVIEW_REMINDER_LEADS_MIN.map((lead) => addMinutes(startsAt, -lead));
  return marks.find((mark) => mark > now) ?? null;
}
