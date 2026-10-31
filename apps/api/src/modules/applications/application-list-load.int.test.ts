import { ConfigService } from '@nestjs/config';
import { afterAll, describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import type { AppConfig } from '../../config/app-config.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { appTestingModule, useTestApp } from '../../test/app.js';
import {
  APPLICATIONS_BOARD_PATH,
  APPLICATIONS_PATH,
  getWithQuery,
  listApplications,
  type QueryString,
  signedInWithSearch,
} from '../../test/applications.js';
import {
  createAiJob,
  createApplicationRows,
  createNotes,
  createScheduledEvent,
  createStageEvents,
  loadedBoardRows,
} from '../../test/factories.js';
import { createQueryLog, type QueryLog } from '../../test/query-log.js';
import { minutesAfter, NOW } from '../../test/time.js';

const LOAD = { few: 5, loaded: 500, maxStatements: 8 } as const;

const TIMING = { warmUpCalls: 5, timedCalls: 30, p95LimitMs: 100, searchP95LimitMs: 50 } as const;

const KAFKA_NOTE = { everyNth: 4, body: 'На скринінгу питали про Kafka і черги' } as const;

type LoadRoute = { name: string; path: string; query: QueryString };

const SEARCH_DROPDOWN: LoadRoute = {
  name: 'the search dropdown',
  path: APPLICATIONS_PATH,
  query: { q: 'kafka', sort: 'relevance', limit: '8' },
};

const ROUTES: readonly LoadRoute[] = [
  { name: 'the default board', path: APPLICATIONS_BOARD_PATH, query: {} },
  {
    name: 'the expanded board',
    path: APPLICATIONS_BOARD_PATH,
    query: { expand: 'rejected,ghosted,withdrawn' },
  },
  { name: 'the first list page', path: APPLICATIONS_PATH, query: { limit: '50' } },
  SEARCH_DROPDOWN,
];

const p95LimitOf = (route: LoadRoute) =>
  route === SEARCH_DROPDOWN ? TIMING.searchP95LimitMs : TIMING.p95LimitMs;

function p95Of(durations: number[]): number {
  const sorted = [...durations].sort((left, right) => left - right);
  return sorted[Math.ceil(0.95 * sorted.length) - 1] ?? Number.POSITIVE_INFINITY;
}

describe('the board and the list with 500 applications', () => {
  let queryLog: QueryLog | undefined;

  const testApp = useTestApp(() =>
    appTestingModule()
      .overrideProvider(Clock)
      .useValue({ now: () => NOW })
      .overrideProvider(PrismaService)
      .useFactory({
        factory: (config: AppConfig) => {
          queryLog = createQueryLog(config.get('DATABASE_URL', { infer: true }));
          return queryLog.prisma;
        },
        inject: [ConfigService],
      }),
  );

  afterAll(() => queryLog?.prisma.$disconnect());

  async function signedInWith(count: number): Promise<string> {
    const { prisma } = testApp;
    const owner = await signedInWithSearch(prisma);
    const rows = loadedBoardRows(count);
    const ids = await createApplicationRows(prisma, { ...owner, rows });
    const loaded = rows.flatMap((row, index) => {
      const applicationId = ids[index];
      return applicationId === undefined ? [] : [{ row, index, applicationId }];
    });
    await createStageEvents(
      prisma,
      loaded.map(({ row, applicationId }) => ({
        applicationId,
        toStage: row.currentStage,
        occurredAt: row.lastEventAt,
      })),
    );
    await createNotes(
      prisma,
      loaded
        .filter(({ index }) => index % KAFKA_NOTE.everyNth === 0)
        .map(({ applicationId }) => ({ applicationId, body: KAFKA_NOTE.body })),
    );
    const withEvents = loaded.filter(({ index }) => index % 3 === 0);
    await Promise.all(
      withEvents.flatMap(({ index, applicationId }) => [
        createScheduledEvent(prisma, {
          applicationId,
          kind: 'screening_call',
          startsAt: minutesAfter((index + 1) * 60),
        }),
        createAiJob(prisma, {
          userId: owner.userId,
          applicationId,
          status: index % 2 === 0 ? 'done' : 'processing',
        }),
      ]),
    );
    return owner.accessToken;
  }

  async function answered(route: LoadRoute, accessToken: string): Promise<void> {
    const response = await getWithQuery(testApp.app, { ...route, accessToken });
    expect(response.status, route.name).toBe(200);
  }

  async function statementsPerRoute(accessToken: string): Promise<number[]> {
    const log = queryLog;
    if (log === undefined) {
      throw new Error('the query log is read before the app started');
    }
    const counts: number[] = [];
    for (const route of ROUTES) {
      counts.push(await log.statementsDuring(() => answered(route, accessToken)));
    }
    return counts;
  }

  async function p95Ms(route: LoadRoute, accessToken: string): Promise<number> {
    for (let call = 0; call < TIMING.warmUpCalls; call += 1) {
      await answered(route, accessToken);
    }
    const durations: number[] = [];
    for (let call = 0; call < TIMING.timedCalls; call += 1) {
      const started = performance.now();
      await answered(route, accessToken);
      durations.push(performance.now() - started);
    }
    return p95Of(durations);
  }

  it(
    'runs as many statements for 500 applications as for 5, and at most 8 per request',
    { timeout: 60_000 },
    async ({ annotate }) => {
      const few = await statementsPerRoute(await signedInWith(LOAD.few));
      const loaded = await statementsPerRoute(await signedInWith(LOAD.loaded));
      await annotate(`statements per route at 5 and 500: ${String(few)} / ${String(loaded)}`);

      expect(loaded).toEqual(few);
      expect(Math.max(...loaded)).toBeLessThanOrEqual(LOAD.maxStatements);
    },
  );

  it(
    'answers the boards and the first list page under 100 ms and a full search dropdown under 50 ms at p95',
    { timeout: 120_000 },
    async ({ annotate }) => {
      const accessToken = await signedInWith(LOAD.loaded);
      const dropdown = await listApplications(testApp.app, {
        accessToken,
        query: SEARCH_DROPDOWN.query,
      });

      for (const route of ROUTES) {
        const p95 = await p95Ms(route, accessToken);
        await annotate(`${route.name}: p95 ${p95.toFixed(1)} ms`);
        expect(p95, route.name).toBeLessThan(p95LimitOf(route));
      }
      expect(dropdown.items).toHaveLength(8);
    },
  );
});
