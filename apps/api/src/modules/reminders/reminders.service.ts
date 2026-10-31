import { Injectable } from '@nestjs/common';

import { nextInterviewReminderAt } from './interview-reminders.js';
import {
  type CloseInterviewReminder,
  type DateRange,
  type FollowupRow,
  type InterviewOfApplication,
  RemindersRepository,
} from './reminders.repository.js';

export type PlanInterview = InterviewOfApplication & { startsAt: Date; now: Date };

@Injectable()
export class RemindersService {
  constructor(private readonly repository: RemindersRepository) {}

  async planInterview(userId: string, { startsAt, now, ...interview }: PlanInterview) {
    await this.repository.closeActiveInterview(userId, { ...interview, status: 'dismissed' });
    const dueAt = nextInterviewReminderAt(startsAt, now);
    if (dueAt !== null) {
      await this.repository.insertInterview(userId, { ...interview, dueAt });
    }
  }

  async closeInterview(userId: string, interview: CloseInterviewReminder): Promise<void> {
    await this.repository.closeActiveInterview(userId, interview);
  }

  followupsBetween(userId: string, range: DateRange): Promise<FollowupRow[]> {
    return this.repository.findFollowups(userId, range);
  }
}
