import type { CalendarItem, CalendarQuery, CalendarResponse } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { addMinutes } from '../../common/add-minutes.js';
import { type FollowupRow, RemindersService } from '../reminders/index.js';
import { scheduledEventTitle } from './scheduled-event-rules.js';
import { type CalendarEventRow, ScheduledEventsRepository } from './scheduled-events.repository.js';

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

function followupItemIn(timeZone: string) {
  const calendarDate = new Intl.DateTimeFormat('en-CA', { timeZone });
  return (followup: FollowupRow): CalendarItem => {
    const { id, applicationId, status, dueAt, snoozedUntil, application } = followup;
    return {
      id,
      title: `${FOLLOWUP_TITLE} · ${application.company}`,
      start: calendarDate.format(status === 'snoozed' ? (snoozedUntil ?? dueAt) : dueAt),
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
    const [events, followups, timeZone] = await Promise.all([
      this.repository.findCalendarEvents(userId, range),
      this.reminders.followupsBetween(userId, range),
      this.repository.findTimeZone(userId),
    ]);
    const items = [...events.map(eventItem), ...followups.map(followupItemIn(timeZone))];
    return { items: items.sort(byStartThenId) };
  }
}
