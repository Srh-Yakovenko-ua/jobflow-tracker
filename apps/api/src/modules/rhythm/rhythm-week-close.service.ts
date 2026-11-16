import type { RhythmQuery, RhythmWeekStatus } from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';

import { AnalyticsClient } from '../../analytics-client/index.js';
import { errorMessageOf } from '../../common/error-message.js';
import type { EventDelivery } from '../../outbox/domain-event-router.js';
import { NotificationsService } from '../notifications/index.js';
import type { RhythmWeekClosedPayload } from './rhythm.events.js';
import { RhythmRepository } from './rhythm.repository.js';
import { RhythmService } from './rhythm.service.js';
import { NO_SUGGESTION, type RhythmSuggestion, suggestedGoalOf } from './rhythm-suggestion.js';

const CLOSE_WINDOW: RhythmQuery = { weeks: 2 };

const QUIET_STATUSES: ReadonlySet<RhythmWeekStatus> = new Set(['no_goal', 'paused']);

@Injectable()
export class RhythmWeekCloseService {
  private readonly logger = new Logger(RhythmWeekCloseService.name);

  constructor(
    private readonly repository: RhythmRepository,
    private readonly rhythm: RhythmService,
    private readonly analytics: AnalyticsClient,
    private readonly notifications: NotificationsService,
  ) {}

  async close(closed: RhythmWeekClosedPayload, delivery: EventDelivery): Promise<void> {
    const { userId, weekStart, requestId } = closed;
    if ((await this.repository.findSettings(userId)) === null) return;
    const suggestion = await this.freshSuggestion(closed, delivery);
    if (suggestion !== null) {
      await this.repository.updateSuggestion(userId, { goal: suggestion.goal });
    }
    const rhythm = await this.rhythm.get(userId, CLOSE_WINDOW);
    const week = rhythm.weeks.find((candidate) => candidate.weekStart === weekStart);
    if (week === undefined || QUIET_STATUSES.has(week.status)) {
      this.logger.log({ requestId, weekStart, status: week?.status }, 'rhythm week closed quietly');
      return;
    }
    await this.notifications.recordOnce(userId, {
      type: 'rhythm_week_closed',
      payload: {
        weekStart,
        applications: week.applications,
        followups: week.followups,
        inRhythm: week.status === 'in_rhythm',
        suggestedGoal: suggestion === null ? rhythm.suggestedGoal : suggestion.goal,
        weeksSooner: suggestion?.weeksSooner ?? null,
      },
    });
    this.logger.log({ requestId, weekStart }, 'rhythm week closed');
  }

  private async freshSuggestion(
    { userId, requestId }: RhythmWeekClosedPayload,
    delivery: EventDelivery,
  ): Promise<RhythmSuggestion | null> {
    try {
      return await this.suggestionFor(userId, requestId);
    } catch (error) {
      if (!delivery.finalAttempt) throw error;
      const fields = { requestId, eventId: delivery.eventId, err: errorMessageOf(error) };
      this.logger.warn(fields, 'weekly goal suggestion kept');
      return null;
    }
  }

  private async suggestionFor(userId: string, requestId?: string): Promise<RhythmSuggestion> {
    const searchId = await this.repository.findActiveSearchId(userId);
    if (searchId === null) return NO_SUGGESTION;
    const analytics = this.analytics.forUser(userId, requestId);
    return suggestedGoalOf((query) => analytics.forecast({ searchId, ...query }));
  }
}
