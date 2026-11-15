import type { ScheduledEventKind } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { addMinutes } from 'date-fns';

import { notFound } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { APPLICATION_NOT_FOUND } from '../../common/owned.js';
import { MatchService } from '../match/index.js';
import { InterviewPrepRepository } from './interview-prep.repository.js';
import { type PreparedVacancy, preparedVacancyOf } from './interview-prep-vacancy.js';

export const INTERVIEW_PREP_LEAD_MIN = 1440;

export type UpcomingInterview = { company: string; kind: ScheduledEventKind; startsAt: Date };

@Injectable()
export class InterviewPrepSources {
  constructor(
    private readonly repository: InterviewPrepRepository,
    private readonly match: MatchService,
    private readonly clock: Clock,
  ) {}

  async prepared(userId: string, applicationId: string): Promise<PreparedVacancy> {
    const now = this.clock.now();
    const row = await this.repository.findSource(userId, { applicationId, now });
    if (row === null) {
      return { refusal: notFound(APPLICATION_NOT_FOUND) };
    }
    const { match } = await this.match.read(userId, applicationId);
    return preparedVacancyOf({ row, match });
  }

  async interviewWithinLead(
    userId: string,
    applicationId: string,
  ): Promise<UpcomingInterview | null> {
    const now = this.clock.now();
    const row = await this.repository.findSource(userId, { applicationId, now });
    const [interview] = row?.scheduledEvents ?? [];
    if (row === null || interview === undefined) {
      return null;
    }
    const soon = interview.startsAt <= addMinutes(now, INTERVIEW_PREP_LEAD_MIN);
    return soon ? { company: row.company, ...interview } : null;
  }
}
