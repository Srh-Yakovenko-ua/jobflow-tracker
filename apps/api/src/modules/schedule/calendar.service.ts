import { TZDate } from '@date-fns/tz';
import {
  type CalendarItem,
  type CalendarQuery,
  type CalendarResponse,
  countedUk,
  DAY_FORMS_UK,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { addMinutes, format } from 'date-fns';

import { type FollowupRow, RemindersService } from '../reminders/index.js';
import { scheduledEventTitle } from './scheduled-event-rules.js';
import {
  type AutoGhostDateRow,
  type CalendarEventRow,
  ScheduledEventsRepository,
} from './scheduled-events.repository.js';

const FOLLOWUP_TITLE = 'Фоллоу-ап';

function eventItem(event: CalendarEventRow): CalendarItem {
  const { id, applicationId, kind, startsAt, durationMin, locationOrLink, status } = event;
  return {
    id,
    title: scheduledEventTitle(kind, event.company),
    start: startsAt.toISOString(),
    end: addMinutes(startsAt, durationMin).toISOString(),
    allDay: false,
    extendedProps: {
      type: 'scheduled_event',
      applicationId,
      company: event.company,
      stage: event.currentStage,
      eventKind: kind,
      status,
      locationOrLink,
    },
  };
}

type CalendarDate = (date: Date) => string;

const calendarDateIn =
  (timeZone: string): CalendarDate =>
  (date) =>
    format(new TZDate(date, timeZone), 'yyyy-MM-dd');

function followupItemOf(calendarDate: CalendarDate) {
  return (followup: FollowupRow): CalendarItem => {
    const { id, applicationId, status, dueAt, snoozedUntil, application } = followup;
    return {
      id,
      title: `${FOLLOWUP_TITLE} · ${application.company}`,
      start: calendarDate(status === 'snoozed' ? (snoozedUntil ?? dueAt) : dueAt),
      end: null,
      allDay: true,
      extendedProps: {
        type: 'followup',
        applicationId,
        company: application.company,
        stage: application.currentStage,
        reminderStatus: status,
      },
    };
  };
}

function autoGhostItemOf(calendarDate: CalendarDate) {
  return (ghost: AutoGhostDateRow): CalendarItem => {
    const { applicationId, company, currentStage, autoGhostDays, ghostAt } = ghost;
    return {
      id: applicationId,
      title: `Ghost за ${countedUk(autoGhostDays, DAY_FORMS_UK)} · ${company}`,
      start: calendarDate(ghostAt),
      end: null,
      allDay: true,
      extendedProps: { type: 'auto_ghost', applicationId, company, stage: currentStage },
    };
  };
}

const byStartThenId = (left: CalendarItem, right: CalendarItem) =>
  left.start.localeCompare(right.start) || left.id.localeCompare(right.id);

@Injectable()
export class CalendarService {
  constructor(
    private readonly repository: ScheduledEventsRepository,
    private readonly reminders: RemindersService,
  ) {}

  async items(userId: string, query: CalendarQuery): Promise<CalendarResponse> {
    const range = { from: new Date(query.from), to: new Date(query.to) };
    const [events, followups, ghosts, timeZone] = await Promise.all([
      this.repository.findCalendarEvents(userId, range),
      this.reminders.followupsBetween(userId, range),
      this.repository.findAutoGhostDates(userId, range),
      this.repository.findTimeZone(userId),
    ]);
    const calendarDate = calendarDateIn(timeZone);
    const items = [
      ...events.map(eventItem),
      ...followups.map(followupItemOf(calendarDate)),
      ...ghosts.map(autoGhostItemOf(calendarDate)),
    ];
    return { items: items.sort(byStartThenId) };
  }
}
