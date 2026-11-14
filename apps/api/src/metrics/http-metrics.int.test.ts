import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { useTestApp } from '../test/app.js';
import {
  applicationPath,
  APPLICATIONS_BOARD_PATH,
  signedInWithSearch,
} from '../test/applications.js';
import { callRoute } from '../test/http.js';

const DURATION = 'http_request_duration_seconds';

type Observed = { route: string; method: string; status: number };

const labelsOf = ({ route, method, status }: Observed) =>
  `{route="${route}",method="${method}",status="${String(status)}"}`;

describe('GET /metrics on the api', () => {
  const testApp = useTestApp();

  const scrapedLines = async () => {
    const response = await callRoute(testApp.app, { method: 'get', path: '/metrics' });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/plain; version=0.0.4; charset=utf-8');
    return response.text.split('\n');
  };

  const getAs = async (path: string) => {
    const { accessToken } = await signedInWithSearch(testApp.prisma);
    return callRoute(testApp.app, { method: 'get', path, accessToken });
  };

  it('observes an authenticated GET of the board under its route template, method and status', async () => {
    const board = await getAs(APPLICATIONS_BOARD_PATH);

    const lines = await scrapedLines();

    expect(board.status).toBe(200);
    const labels = labelsOf({ route: APPLICATIONS_BOARD_PATH, method: 'GET', status: 200 });
    expect(lines).toContain(`${DURATION}_count${labels} 1`);
    expect(
      lines.filter(
        (line) => line.startsWith(`${DURATION}_bucket{`) && line.includes(labels.slice(1, -1)),
      ),
    ).not.toEqual([]);
  });

  it('labels an id path with its :id template and a path no route matches with unmatched', async () => {
    await getAs(applicationPath(randomUUID()));
    await getAs(applicationPath(randomUUID()));
    await callRoute(testApp.app, { method: 'get', path: '/api/v1/nowhere' });
    await callRoute(testApp.app, { method: 'get', path: '/nowhere' });

    const lines = await scrapedLines();

    expect(lines).toEqual(
      expect.arrayContaining([
        `${DURATION}_count${labelsOf({ route: '/api/v1/applications/:id', method: 'GET', status: 404 })} 2`,
        `${DURATION}_count${labelsOf({ route: 'unmatched', method: 'GET', status: 404 })} 2`,
      ]),
    );
  });

  it('never observes its own scrape', async () => {
    await scrapedLines();

    const lines = await scrapedLines();

    expect(
      lines.filter((line) => line.includes('status="200"') && line.includes('route="unmatched"')),
    ).toEqual([]);
  });

  it('answers a POST /metrics with 404', async () => {
    const response = await callRoute(testApp.app, { method: 'post', path: '/metrics' });

    expect(response.status).toBe(404);
  });
});
