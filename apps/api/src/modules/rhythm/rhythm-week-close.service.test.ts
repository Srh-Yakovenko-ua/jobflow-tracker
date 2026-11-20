import type { RhythmQuery, RhythmResponse, RhythmWeek } from '@jobflow/shared';
import { buildInsufficientForecast } from '@jobflow/shared/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ANALYTICS,
  analyticsClientProvider,
  jsonReply as json,
} from '../../test/analytics-client.js';
import {
  type FetchReply,
  recordFetch,
  refusedConnection,
  stalled,
  timeOutAtOnce,
} from '../../test/fetch.js';
import { memoryLog } from '../../test/memory-log.js';
import { RecordingNotifications } from '../../test/notifications.js';
import { compileProcessorModule } from '../../test/processor.js';
import { designStoryForecastAt } from '../../test/rhythm.js';
import {
  BOHDAN_ID,
  FINAL_DELIVERY,
  FIRST_DELIVERY,
  OLENA_ID,
  SEARCH_ID,
} from '../../test/service-fixtures.js';
import { NotificationsService } from '../notifications/index.js';
import type { RhythmWeekClosedPayload } from './rhythm.events.js';
import { RhythmRepository, type UpdateSuggestion } from './rhythm.repository.js';
import { RhythmService } from './rhythm.service.js';
import { RhythmWeekCloseService } from './rhythm-week-close.service.js';

const log = memoryLog();

const CLOSED: RhythmWeekClosedPayload = {
  userId: OLENA_ID,
  weekStart: '2026-11-09',
  requestId: 'req-1',
};

const FORECAST_URL = `${ANALYTICS}/forecast?searchId=${SEARCH_ID}`;

const CLOSED_WEEK: RhythmWeek = {
  weekStart: '2026-11-09',
  applications: 3,
  followups: 1,
  interviews: 1,
  offers: 0,
  status: 'in_rhythm',
};

const CURRENT_WEEK: RhythmWeek = { ...CLOSED_WEEK, weekStart: '2026-11-16', status: 'in_progress' };

const STORED_SUGGESTION = 7;

const RATES = Array.from({ length: 30 }, (_, index) => index + 1);

const designStoryReplies = (): Record<string, FetchReply> => ({
  [FORECAST_URL]: json(designStoryForecastAt()),
  ...Object.fromEntries(
    RATES.map((rate): [string, FetchReply] => [
      `${FORECAST_URL}&applicationsPerWeek=${String(rate)}`,
      json(designStoryForecastAt(rate)),
    ]),
  ),
});

class FakeRhythmRepository {
  readonly suggestions: (UpdateSuggestion & { userId: string })[] = [];

  searchId: string | null = SEARCH_ID;

  hasSettings(userId: string): Promise<boolean> {
    return Promise.resolve(userId === OLENA_ID);
  }

  findActiveSearchId(): Promise<string | null> {
    return Promise.resolve(this.searchId);
  }

  updateSuggestion(userId: string, update: UpdateSuggestion): Promise<void> {
    this.suggestions.push({ userId, ...update });
    return Promise.resolve();
  }
}

class FakeRhythm {
  closedWeek: RhythmWeek = CLOSED_WEEK;

  readonly queries: RhythmQuery[] = [];

  get(_userId: string, query: RhythmQuery): Promise<RhythmResponse> {
    this.queries.push(query);
    return Promise.resolve({
      goal: { applications: 5, followups: null },
      suggestedGoal: STORED_SUGGESTION,
      pausedFrom: null,
      pausedUntil: null,
      weeks: [this.closedWeek, CURRENT_WEEK],
      streak: 1,
      bestWeek: null,
    });
  }
}

async function weekCloseWithFakes() {
  const repository = new FakeRhythmRepository();
  const rhythm = new FakeRhythm();
  const notifications = new RecordingNotifications();
  const moduleRef = await compileProcessorModule(log.sink, [
    RhythmWeekCloseService,
    analyticsClientProvider(),
    { provide: RhythmRepository, useValue: repository },
    { provide: RhythmService, useValue: rhythm },
    { provide: NotificationsService, useValue: notifications },
  ]);
  const service = moduleRef.get(RhythmWeekCloseService);
  const close = (delivery = FIRST_DELIVERY, closed = CLOSED) => service.close(closed, delivery);
  return { repository, rhythm, notifications, close };
}

const suggestedGoals = ({ suggestions }: FakeRhythmRepository) =>
  suggestions.map(({ goal }) => goal);

beforeEach(() => {
  log.lines.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('RhythmWeekCloseService.close', () => {
  it('stores the design-story suggestion and records the closed week once with it', async () => {
    recordFetch({ replies: designStoryReplies(), decodeBody: () => null });
    const { repository, rhythm, notifications, close } = await weekCloseWithFakes();

    await close();
    await close();

    expect(suggestedGoals(repository)).toEqual([5, 5]);
    expect(rhythm.queries).toEqual([{ weeks: 2 }, { weeks: 2 }]);
    expect(notifications.notifications).toEqual([
      {
        userId: OLENA_ID,
        type: 'rhythm_week_closed',
        payload: {
          weekStart: '2026-11-09',
          applications: 3,
          followups: 1,
          inRhythm: true,
          suggestedGoal: 5,
          weeksSooner: 2,
        },
      },
    ]);
  });

  it('records a week below the goal as not in rhythm', async () => {
    recordFetch({ replies: designStoryReplies(), decodeBody: () => null });
    const { rhythm, notifications, close } = await weekCloseWithFakes();
    rhythm.closedWeek = { ...CLOSED_WEEK, interviews: 0, status: 'next_week' };

    await close();

    expect(notifications.notifications[0]?.payload).toMatchObject({ inRhythm: false });
  });

  it.each([{ status: 'paused' as const }, { status: 'no_goal' as const }])(
    'refreshes the suggestion but records nothing for a $status week',
    async ({ status }) => {
      recordFetch({ replies: designStoryReplies(), decodeBody: () => null });
      const { repository, rhythm, notifications, close } = await weekCloseWithFakes();
      rhythm.closedWeek = { ...CLOSED_WEEK, status };

      await close();

      expect(suggestedGoals(repository)).toEqual([5]);
      expect(notifications.notifications).toEqual([]);
    },
  );

  it('stores no suggestion and asks no what-if below the forecast threshold', async () => {
    const calls = recordFetch({
      replies: { [FORECAST_URL]: json(buildInsufficientForecast()) },
      decodeBody: () => null,
    });
    const { repository, notifications, close } = await weekCloseWithFakes();

    await close();

    expect(suggestedGoals(repository)).toEqual([null]);
    expect(calls.map(({ url }) => url)).toEqual([FORECAST_URL]);
    expect(notifications.notifications[0]?.payload).toMatchObject({
      suggestedGoal: null,
      weeksSooner: null,
    });
  });

  it('stores no suggestion and calls no analytics without an active search', async () => {
    const calls = recordFetch({ replies: designStoryReplies(), decodeBody: () => null });
    const { repository, close } = await weekCloseWithFakes();
    repository.searchId = null;

    await close();

    expect([suggestedGoals(repository), calls]).toEqual([[null], []]);
  });

  it('does nothing for a user who is gone', async () => {
    const calls = recordFetch({ replies: designStoryReplies(), decodeBody: () => null });
    const { repository, notifications, close } = await weekCloseWithFakes();

    await close(FIRST_DELIVERY, { ...CLOSED, userId: BOHDAN_ID });

    expect([repository.suggestions, notifications.notifications, calls]).toEqual([[], [], []]);
  });

  describe.each([
    { case: 'refuses the connection', reply: () => Promise.reject(refusedConnection) },
    { case: 'stays silent', reply: stalled },
  ])('when analytics $case', ({ reply }) => {
    it('rethrows before the final attempt and writes nothing', async () => {
      timeOutAtOnce();
      recordFetch({ replies: reply, decodeBody: () => null });
      const { repository, notifications, close } = await weekCloseWithFakes();

      await expect(close()).rejects.toMatchObject({ name: 'AnalyticsServiceError' });

      expect([repository.suggestions, notifications.notifications]).toEqual([[], []]);
    });

    it('keeps the stored suggestion and still closes the week on the final attempt', async () => {
      timeOutAtOnce();
      recordFetch({ replies: reply, decodeBody: () => null });
      const { repository, notifications, close } = await weekCloseWithFakes();

      await close(FINAL_DELIVERY);

      expect(repository.suggestions).toEqual([]);
      expect(notifications.notifications[0]?.payload).toMatchObject({
        suggestedGoal: STORED_SUGGESTION,
        weeksSooner: null,
      });
      expect(log.parsed()).toContainEqual(
        expect.objectContaining({ requestId: 'req-1', msg: 'weekly goal suggestion kept' }),
      );
    });
  });
});
