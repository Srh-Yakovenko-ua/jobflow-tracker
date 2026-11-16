import { LIVE_EVENTS } from '@jobflow/shared';
import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { DEPENDENCY_LIMITS } from '../../common/probe.js';
import { RedisService } from '../../redis/redis.service.js';
import { RecordingLivePublisher } from '../../test/live.js';
import { sampleApplicationPayload } from '../../test/outbox.js';
import {
  APPLICATION_ID,
  MOVE_EVENT_ID,
  OLENA_ID,
  RESUME_VERSION_ID,
  SEARCH_ID,
} from '../../test/service-fixtures.js';
import { useSubscribedRouter } from '../../test/subscriber.js';
import { outcomeWithin } from '../../test/tcp-proxy.js';
import { LivePublisher } from '../live/index.js';
import { AnalyticsCacheService } from './analytics-cache.service.js';
import { AnalyticsCacheSubscriber } from './analytics-cache.subscriber.js';

const OLENA_VERSION_KEY = 'analytics:0199f0a0-0000-7000-8000-000000000001:version';

const ANSWER_LIMIT_MS = DEPENDENCY_LIMITS.pingTimeoutMs + 500;

const STAGE_CHANGED = sampleApplicationPayload({
  eventType: 'application.stage_changed',
  userId: OLENA_ID,
});

const APPLICATION_CHANGES = [
  'application.created',
  'application.updated',
  'application.stage_changed',
] as const;

const OUTAGES = [
  {
    outage: 'refuses the connection',
    answer: () => Promise.reject(new Error('Connection is closed.')),
    error: 'Connection is closed.',
  },
  {
    outage: 'never answers',
    answer: () => new Promise<number>(() => undefined),
    error: 'timed out after 1000 ms',
  },
];

class CountingRedis {
  readonly versions = new Map<string, number>();
  outage: (() => Promise<number>) | null = null;

  readonly client = {
    incr: (key: string): Promise<number> => {
      if (this.outage !== null) {
        return this.outage();
      }
      const version = (this.versions.get(key) ?? 0) + 1;
      this.versions.set(key, version);
      return Promise.resolve(version);
    },
  };
}

describe('AnalyticsCacheSubscriber', () => {
  const redis = new CountingRedis();
  const live = new RecordingLivePublisher();
  const { log, route, routeFinal } = useSubscribedRouter([
    AnalyticsCacheSubscriber,
    AnalyticsCacheService,
    { provide: LivePublisher, useValue: live },
    { provide: RedisService, useValue: redis },
  ]);

  const warnings = () => log.parsed().filter(({ level }) => level === 40);

  beforeEach(() => {
    redis.versions.clear();
    live.published.length = 0;
    redis.outage = null;
  });

  it.each([
    ...APPLICATION_CHANGES.map((eventType) => ({
      type: eventType,
      payload: sampleApplicationPayload({ eventType, userId: OLENA_ID }),
    })),
    {
      type: 'resume.attached',
      payload: {
        userId: OLENA_ID,
        resumeVersionId: RESUME_VERSION_ID,
        applicationId: APPLICATION_ID,
      },
    },
  ])("bumps the user's analytics version once on $type", async ({ type, payload }) => {
    await route(type, payload);

    expect(Object.fromEntries(redis.versions)).toEqual({ [OLENA_VERSION_KEY]: 1 });
  });

  it.each([
    {
      title: 'finishing a search with no open cards changes the dashboard numbers',
      type: 'search.finished',
      payload: { userId: OLENA_ID, searchId: SEARCH_ID },
    },
    {
      title: 'a timezone change refreshes the funnel KPIs',
      type: 'settings.changed',
      payload: { userId: OLENA_ID, fields: ['timezone'] },
    },
    {
      title: 'a CV rename shows the new title in resume A/B',
      type: 'resume.version_updated',
      payload: { userId: OLENA_ID, resumeVersionId: RESUME_VERSION_ID },
    },
  ])('$title', async ({ type, payload }) => {
    await route(type, payload);

    expect(Object.fromEntries(redis.versions)).toEqual({ [OLENA_VERSION_KEY]: 1 });
  });

  it('tells the open dashboard after the bump', async () => {
    await route('application.stage_changed', STAGE_CHANGED);

    expect(live.published).toEqual([
      { userId: OLENA_ID, event: { type: LIVE_EVENTS.analyticsChanged, data: {} } },
    ]);
  });

  it('bumps nothing on a capture request, which changes no numbers', async () => {
    const payload = sampleApplicationPayload({
      eventType: 'application.capture_requested',
      userId: OLENA_ID,
    });

    await expect(route('application.capture_requested', payload)).resolves.toBe(0);

    expect(redis.versions.size).toBe(0);
  });

  it('fails a stage change without its stages as unrecoverable and bumps nothing', async () => {
    const payload = { userId: OLENA_ID, applicationId: APPLICATION_ID };

    await expect(route('application.stage_changed', payload)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );

    expect(redis.versions.size).toBe(0);
    expect(log.parsed()).toEqual([
      expect.objectContaining({
        level: 50,
        msg: 'analytics cache event invalid',
        eventId: MOVE_EVENT_ID,
      }),
    ]);
  });

  it.each(OUTAGES)(
    'fails a first attempt within the ping limit while Redis $outage, so the event retries',
    async ({ answer, error }) => {
      redis.outage = answer;

      const outcome = await outcomeWithin(
        route('application.stage_changed', STAGE_CHANGED),
        ANSWER_LIMIT_MS,
      );

      expect(outcome).toEqual(new Error(error));
      expect(warnings()).toEqual([]);
      expect(live.published).toEqual([]);
    },
  );

  it.each(OUTAGES)(
    'settles the final attempt with one warning while Redis $outage, so later subscribers still run',
    async ({ answer, error }) => {
      redis.outage = answer;

      const outcome = await outcomeWithin(
        routeFinal('application.stage_changed', STAGE_CHANGED),
        ANSWER_LIMIT_MS,
      );

      expect(outcome).toBe('answered');
      expect(warnings()).toEqual([
        expect.objectContaining({
          msg: 'analytics cache not invalidated',
          eventId: MOVE_EVENT_ID,
          userId: '33d3c10ead285aee',
          err: error,
        }),
      ]);
      expect(log.lines.join('')).not.toContain(OLENA_ID);
      expect(live.published).toEqual([]);
    },
  );
});
