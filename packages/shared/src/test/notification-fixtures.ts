import type {
  AiDoneNotificationPayload,
  ExportReadyNotificationPayload,
  InterviewPrepReadyNotificationPayload,
  InterviewSoonNotificationPayload,
  MonthlySummaryReadyNotificationPayload,
  SilenceItem,
  SilenceNotificationPayload,
} from '../notifications.js';

export const APPLICATION_ID = '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e1f';
export const NOTIFICATION_ID = '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e21';

export const SILENCE_ITEM: SilenceItem = {
  applicationId: APPLICATION_ID,
  company: 'Acme',
  days: 4,
};

export const SILENCE: SilenceNotificationPayload = { items: [SILENCE_ITEM] };

export const INTERVIEW_SOON: InterviewSoonNotificationPayload = {
  applicationId: APPLICATION_ID,
  scheduledEventId: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e20',
  company: 'Acme',
  startsAt: '2026-11-03T14:00:00.000Z',
  minutesBefore: 120,
};

export const AI_DONE: AiDoneNotificationPayload = {
  aiJobId: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e22',
  kind: 'vacancy_parse',
  applicationId: APPLICATION_ID,
};

export const MONTHLY_SUMMARY_READY: MonthlySummaryReadyNotificationPayload = {
  aiJobId: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e23',
  month: '2026-08',
};

export const EXPORT_READY: ExportReadyNotificationPayload = {
  exportId: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e24',
  format: 'csv',
};

export const INTERVIEW_PREP_READY: InterviewPrepReadyNotificationPayload = {
  aiJobId: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e25',
  applicationId: APPLICATION_ID,
  company: 'Acme',
  eventKind: 'tech_interview',
  startsAt: '2026-11-14T09:00:00.000Z',
};

export const NOTIFICATION_ROW = {
  id: NOTIFICATION_ID,
  readAt: null,
  createdAt: '2026-11-13T09:00:00.000Z',
};
