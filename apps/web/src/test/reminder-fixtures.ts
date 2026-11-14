import {
  type BoardCard,
  type CalendarResponse,
  OPEN_STAGES,
  type Reminder,
  type ReminderListResponse,
  reminderSchema,
  type ReminderStatus,
  snoozeReminderInputSchema,
  type Stage,
} from '@jobflow/shared';
import { addDays, subMilliseconds } from 'date-fns';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl, errorReply } from './api-handlers';
import { boardOf, cardIn, fixtureIdOf } from './board-fixtures';
import { followupItemOf, scheduledItemOf } from './calendar-fixtures';

export type SilentCardSeed = { serial: number; company: string; days: number; stage?: Stage };

export type FollowupSeed = {
  card: BoardCard;
  status?: ReminderStatus;
  snoozedUntil?: string | null;
};

export type RemindersRouteOptions = Readonly<{
  items?: readonly Reminder[];
  listReply?: HttpResponseResolver;
  snoozeReply?: HttpResponseResolver<{ id: string }>;
}>;

export const REMINDER_NOW = new Date('2026-11-14T10:00:00.000Z');

export const IN_THREE_DAYS = addDays(REMINDER_NOW, 3).toISOString();

const REMINDER_SERIAL_OFFSET = 500;

const INTERVIEW_SOON_SERIAL_OFFSET = 600;

export function silentCardOf({
  serial,
  company,
  days,
  stage = 'applied',
}: SilentCardSeed): BoardCard {
  const card = cardIn({ serial, stage, position: `Vacancy ${String(serial)}` });
  return { ...card, company, daysSinceLastEvent: days, silenceLevel: 'silent' };
}

function serialOf(card: BoardCard): number {
  return Number(card.id.slice(-12));
}

export function reminderIdOf(card: BoardCard): string {
  return fixtureIdOf(serialOf(card) + REMINDER_SERIAL_OFFSET);
}

export function followupOf({ card, status = 'pending', snoozedUntil = null }: FollowupSeed) {
  return reminderSchema.parse({
    id: reminderIdOf(card),
    applicationId: card.id,
    company: card.company,
    stage: card.currentStage,
    type: 'followup',
    status,
    scheduledEventId: null,
    dueAt: REMINDER_NOW.toISOString(),
    snoozedUntil,
  });
}

export const ACME_SILENT = silentCardOf({
  serial: 801,
  company: 'Acme',
  days: 14,
  stage: 'screening',
});

export const KVIT_SILENT = silentCardOf({ serial: 802, company: 'Kvit Software', days: 9 });

export const ZORIA_SILENT = silentCardOf({
  serial: 803,
  company: 'Zoria Tech',
  days: 21,
  stage: 'tech_interview',
});

export const SILENT_CARDS: readonly BoardCard[] = [ACME_SILENT, KVIT_SILENT, ZORIA_SILENT];

export const SILENT_FOLLOWUPS: readonly Reminder[] = [
  followupOf({ card: ACME_SILENT }),
  followupOf({ card: KVIT_SILENT }),
];

export const SNOOZE_ENDED = subMilliseconds(REMINDER_NOW, 1).toISOString();

export function interviewSoonOf(card: BoardCard) {
  return reminderSchema.parse({
    ...followupOf({ card }),
    id: fixtureIdOf(serialOf(card) + INTERVIEW_SOON_SERIAL_OFFSET),
    type: 'interview_soon',
    scheduledEventId: fixtureIdOf(serialOf(card)),
  });
}

export const REMINDER_LIST: ReminderListResponse = {
  items: [
    followupOf({ card: ZORIA_SILENT }),
    followupOf({ card: ACME_SILENT, status: 'snoozed', snoozedUntil: SNOOZE_ENDED }),
    followupOf({ card: KVIT_SILENT, status: 'snoozed', snoozedUntil: IN_THREE_DAYS }),
    interviewSoonOf(KVIT_SILENT),
  ],
};

export const NEXT_INTERVIEW = scheduledItemOf({
  serial: 901,
  kind: 'tech_interview',
  start: '2026-11-15T12:00:00.000Z',
});

export const INTERVIEW_CALENDAR = {
  laterCall: scheduledItemOf({
    serial: 902,
    kind: 'screening_call',
    start: '2026-11-20T08:00:00.000Z',
  }),
  startingNow: scheduledItemOf({
    serial: 903,
    kind: 'final_interview',
    start: REMINDER_NOW.toISOString(),
  }),
  alreadyStarted: scheduledItemOf({ serial: 904, kind: 'tech_interview', start: SNOOZE_ENDED }),
  done: scheduledItemOf({
    serial: 905,
    kind: 'tech_interview',
    start: '2026-11-15T09:00:00.000Z',
    status: 'done',
  }),
  cancelled: scheduledItemOf({
    serial: 906,
    kind: 'tech_interview',
    start: '2026-11-16T09:00:00.000Z',
    status: 'cancelled',
  }),
  followup: followupItemOf({ serial: 907, date: '2026-11-15' }),
} as const;

export const INTERVIEW_CALENDAR_BODY: CalendarResponse = {
  items: [
    INTERVIEW_CALENDAR.laterCall,
    INTERVIEW_CALENDAR.cancelled,
    NEXT_INTERVIEW,
    INTERVIEW_CALENDAR.followup,
    INTERVIEW_CALENDAR.done,
    INTERVIEW_CALENDAR.alreadyStarted,
    INTERVIEW_CALENDAR.startingNow,
  ],
};

export function silentBoardOf(cards: readonly BoardCard[]) {
  const counts = Object.fromEntries(
    OPEN_STAGES.map((stage) => [stage, cards.filter((card) => card.currentStage === stage).length]),
  );
  return boardOf(counts, { cards, stages: OPEN_STAGES });
}

function snoozedReply(stored: Reminder[]): HttpResponseResolver<{ id: string }> {
  return async ({ request, params }) => {
    const { days } = snoozeReminderInputSchema.parse(await request.json());
    const at = stored.findIndex((item) => item.id === params.id);
    const reminder = stored[at];
    if (reminder === undefined) return errorReply({ status: 404, type: 'not_found' });
    const snoozed: Reminder = {
      ...reminder,
      status: 'snoozed',
      snoozedUntil: addDays(REMINDER_NOW, days).toISOString(),
    };
    stored.splice(at, 1, snoozed);
    return HttpResponse.json(snoozed);
  };
}

export function remindersRoutes({
  items = SILENT_FOLLOWUPS,
  listReply,
  snoozeReply,
}: RemindersRouteOptions = {}) {
  const stored = [...items];
  const sent = { snoozes: [] as { id: string; body: unknown }[] };
  const replyToSnooze = snoozeReply ?? snoozedReply(stored);
  const handlers = [
    http.get(apiUrl('/reminders'), (info) => {
      const list: ReminderListResponse = { items: [...stored] };
      return listReply === undefined ? HttpResponse.json(list) : listReply(info);
    }),
    http.post<{ id: string }>(apiUrl('/reminders/:id/snooze'), async (info) => {
      sent.snoozes.push({ id: info.params.id, body: await info.request.clone().json() });
      return replyToSnooze(info);
    }),
  ];
  return { handlers, sent };
}
