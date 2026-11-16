import { z } from 'zod';

import type { NotificationType } from './notifications.js';

export const EMAILED_TYPES = [
  'monthly_summary_ready',
  'silence',
  'interview_prep_ready',
] as const satisfies readonly NotificationType[];

export const emailedTypeSchema = z.enum(EMAILED_TYPES);

export type EmailedType = z.infer<typeof emailedTypeSchema>;

export type EmailSettingKey = 'emailMonthlySummary' | 'emailSilence' | 'emailInterviewPrep';

export const EMAIL_SETTING_OF: Record<EmailedType, EmailSettingKey> = {
  monthly_summary_ready: 'emailMonthlySummary',
  silence: 'emailSilence',
  interview_prep_ready: 'emailInterviewPrep',
};

export const emailUnsubscribeInputSchema = z.object({ token: z.string().min(1).max(2048) });

export const emailUnsubscribeResponseSchema = z.object({ type: emailedTypeSchema });

export type EmailUnsubscribeInput = z.infer<typeof emailUnsubscribeInputSchema>;
export type EmailUnsubscribeResponse = z.infer<typeof emailUnsubscribeResponseSchema>;
