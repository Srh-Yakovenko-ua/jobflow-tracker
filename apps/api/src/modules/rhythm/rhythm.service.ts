import {
  isWeekPaused,
  type RhythmGoal,
  type RhythmQuery,
  type RhythmResponse,
  type RhythmWeek,
  type RhythmWeekCounts,
  streakOf,
  userNow,
  type UserSettings,
  weekStartOf,
  weekStatusOf,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { addWeeks, startOfISOWeek, subWeeks } from 'date-fns';

import { Clock } from '../../common/clock.js';
import { TimelineService } from '../events/index.js';
import { SettingsService } from '../settings/index.js';
import { type RhythmEventRow, RhythmRepository } from './rhythm.repository.js';

type WeekContext = { settings: UserSettings; goal: RhythmGoal; currentWeek: string };

type WeekCounts = { weekStart: string; counts: RhythmWeekCounts };

type BestWeek = RhythmResponse['bestWeek'];

const QUIET_WEEK: RhythmWeekCounts = { applications: 0, followups: 0, interviews: 0, offers: 0 };

function countsByWeek(rows: RhythmEventRow[], settings: UserSettings) {
  const counts = new Map<string, RhythmWeekCounts>();
  for (const { kind, occurredAt } of rows) {
    const weekStart = weekStartOf(settings, occurredAt);
    const week = counts.get(weekStart) ?? QUIET_WEEK;
    counts.set(weekStart, { ...week, [kind]: week[kind] + 1 });
  }
  return counts;
}

const bestWeekOf = (weeks: RhythmWeek[]): BestWeek =>
  weeks.reduce<BestWeek>(
    (best, { weekStart, applications }) =>
      applications > 0 && applications >= (best?.applications ?? 0)
        ? { weekStart, applications }
        : best,
    null,
  );

function rhythmWeekOf(
  { weekStart, counts }: WeekCounts,
  { settings, goal, currentWeek }: WeekContext,
): RhythmWeek {
  const status = weekStatusOf(counts, {
    goal,
    paused: isWeekPaused(weekStart, settings),
    current: weekStart === currentWeek,
  });
  return { weekStart, ...counts, status };
}

@Injectable()
export class RhythmService {
  constructor(
    private readonly repository: RhythmRepository,
    private readonly timeline: TimelineService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  private async eventsSince(userId: string, since: Date): Promise<RhythmEventRow[]> {
    const [stageEvents, followups] = await Promise.all([
      this.repository.stageEventsSince(userId, since),
      this.timeline.occurrencesSince(userId, { kind: 'followup_sent', since }),
    ]);
    return [
      ...stageEvents,
      ...followups.map(({ occurredAt }) => ({ kind: 'followups' as const, occurredAt })),
    ];
  }

  async get(userId: string, { weeks }: RhythmQuery): Promise<RhythmResponse> {
    const now = this.clock.now();
    const settings = await this.settings.get(userId);
    const oldest = startOfISOWeek(subWeeks(userNow(settings, now), weeks - 1));
    const counts = countsByWeek(await this.eventsSince(userId, oldest), settings);
    const goal = {
      applications: settings.weeklyGoalApplications,
      followups: settings.weeklyGoalFollowups,
    };
    const context = { settings, goal, currentWeek: weekStartOf(settings, now) };
    const rhythmWeeks = Array.from({ length: weeks }, (_, index) => {
      const weekStart = weekStartOf(settings, addWeeks(oldest, index));
      return rhythmWeekOf({ weekStart, counts: counts.get(weekStart) ?? QUIET_WEEK }, context);
    });
    return {
      goal,
      suggestedGoal: settings.suggestedWeeklyGoal,
      pausedFrom: settings.pausedFrom,
      pausedUntil: settings.pausedUntil,
      weeks: rhythmWeeks,
      streak: streakOf(rhythmWeeks),
      bestWeek: bestWeekOf(rhythmWeeks),
    };
  }
}
