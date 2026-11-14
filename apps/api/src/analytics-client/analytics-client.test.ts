import type { ErrorResponse } from '@jobflow/shared';
import { buildDesignFunnel, buildForecast, designInsightsBody } from '@jobflow/shared/testing';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { validateEnv } from '../config/env.js';
import { testJwtKeys, verifyWithTestKey } from '../test/auth.js';
import { exampleEnv } from '../test/example-env.js';
import {
  type FetchReply,
  recordFetch,
  refusedConnection,
  stalled,
  timeOutAtOnce,
} from '../test/fetch.js';
import { OLENA_ID, SEARCH_ID } from '../test/service-fixtures.js';
import { AnalyticsClient } from './analytics-client.js';

const ANALYTICS_URL = 'http://analytics.test:8000';

const analytics = new AnalyticsClient(
  new ConfigService(validateEnv({ ...exampleEnv, ANALYTICS_URL })),
  testJwtKeys,
).forUser(OLENA_ID, 'req-an-5');

const replyWith = (reply: FetchReply) => recordFetch({ replies: reply, decodeBody: () => null });

const NOT_FOUND: ErrorResponse = {
  type: 'not_found',
  title: 'Not found',
  status: 404,
  detail: 'Search not found',
  requestId: 'req-an-5',
};

const analyticsError = (status: number, type: string) => ({
  name: 'AnalyticsServiceError',
  status,
  type,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AnalyticsClient.forUser', () => {
  it('gets the funnel of a month with a 60 s analytics:read token for the user and the request id', async () => {
    const calls = replyWith(() => Response.json(buildDesignFunnel()));

    expect(await analytics.funnel({ searchId: SEARCH_ID, month: '2026-08' })).toEqual(
      buildDesignFunnel(),
    );

    expect(calls.map(({ url }) => url)).toEqual([
      `http://analytics.test:8000/analytics/funnel?searchId=${SEARCH_ID}&month=2026-08`,
    ]);
    expect(calls[0]?.headers.get('x-request-id')).toBe('req-an-5');
    const token = calls[0]?.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
    const { claims } = await verifyWithTestKey(token, new Date());
    expect(claims).toMatchObject({
      iss: 'jobflow-api',
      aud: 'jobflow-analytics',
      sub: OLENA_ID,
      scope: 'analytics:read',
    });
    expect(Number(claims.exp) - Number(claims.iat)).toBe(60);
  });

  it('gets the what-if forecast with the improve query and the resume A/B without a query', async () => {
    const calls = replyWith(() => Response.json(buildForecast()));

    await analytics.forecast({ searchId: SEARCH_ID, improve: 'tech_interview:0.6' });

    expect(calls.map(({ url }) => url)).toEqual([
      `http://analytics.test:8000/analytics/forecast?searchId=${SEARCH_ID}&improve=tech_interview%3A0.6`,
    ]);
    replyWith(() => Response.json({ versions: [], comparison: null }));
    await expect(analytics.resumeAb()).resolves.toEqual({ versions: [], comparison: null });
  });

  it.each([
    {
      answer: 'the DOC-04 404 of analytics',
      reply: () => Response.json(NOT_FOUND, { status: 404 }),
      error: analyticsError(404, 'not_found'),
    },
    {
      answer: 'a 200 whose body is no insights body',
      reply: () => Response.json({ insights: 'none' }),
      error: analyticsError(502, 'unexpected_response'),
    },
    {
      answer: 'a refused connection',
      reply: () => Promise.reject(refusedConnection),
      error: analyticsError(503, 'not_ready'),
    },
  ])('turns $answer into an AnalyticsServiceError', async ({ reply, error }) => {
    replyWith(reply);

    await expect(analytics.insights({ searchId: SEARCH_ID })).rejects.toMatchObject(error);
  });

  it('parses the insights body it is given', async () => {
    replyWith(() => Response.json(designInsightsBody()));

    await expect(analytics.insights({})).resolves.toEqual(designInsightsBody());
  });

  it('gives up on an analytics service that keeps the connection open at the 10 s limit with 504 analytics_timeout', async () => {
    const timeout = timeOutAtOnce();
    replyWith(stalled);

    await expect(analytics.sources({ searchId: SEARCH_ID })).rejects.toMatchObject(
      analyticsError(504, 'analytics_timeout'),
    );
    expect(timeout).toHaveBeenCalledWith(10_000);
  });
});
