import type { RejectionReasonsSummary } from '@jobflow/shared';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { errorReply, type Outage, REFUSED_CONNECTION } from '@/test/api-handlers';
import { reasonsSummaryRoute, type ReasonsSummaryRouteOptions } from '@/test/board-fixtures';
import { latch } from '@/test/latch';
import { server } from '@/test/server';

import { fetchReasonsSummary } from './reasons-summary';

const ANALYTICS_REASONS: RejectionReasonsSummary['reasons'] = [
  { code: 'skills_gap', count: 3 },
  { code: 'chose_other', count: 1 },
];

const API_REASONS: RejectionReasonsSummary['reasons'] = [{ code: 'low_salary', count: 2 }];

const ANALYTICS_DOWN: readonly Pick<Outage, 'name' | 'reply'>[] = [
  { name: 'answers 503', reply: () => errorReply({ status: 503, type: 'dependency_unavailable' }) },
  { name: 'refuses the connection', reply: REFUSED_CONNECTION.reply },
];

function routes(analytics: Omit<ReasonsSummaryRouteOptions, 'target'>) {
  const fromAnalytics = reasonsSummaryRoute({ ...analytics, target: 'analytics' });
  const fromApi = reasonsSummaryRoute({ reasons: API_REASONS, target: 'api' });
  server.use(fromAnalytics.handler, fromApi.handler);
  return { analytics: fromAnalytics.sent, api: fromApi.sent };
}

function load(signal = new AbortController().signal) {
  return fetchReasonsSummary({ stage: 'tech_interview', signal });
}

describe('fetchReasonsSummary', () => {
  it('reads the summary from analytics and never asks the API', async () => {
    const asked = routes({ reasons: ANALYTICS_REASONS });

    expect(await load()).toEqual({ stage: 'tech_interview', total: 4, reasons: ANALYTICS_REASONS });
    expect(asked).toEqual({ analytics: ['tech_interview'], api: [] });
  });

  it.each(ANALYTICS_DOWN)('when analytics $name the API summary is used', async ({ reply }) => {
    const asked = routes({ reply });

    expect(await load()).toEqual({ stage: 'tech_interview', total: 2, reasons: API_REASONS });
    expect(asked).toEqual({ analytics: ['tech_interview'], api: ['tech_interview'] });
  });

  it('an aborted request rejects and asks neither analytics again nor the API', async () => {
    const held = latch();
    const asked = routes({ reasons: ANALYTICS_REASONS, latch: held });
    const controller = new AbortController();

    const loading = load(controller.signal);
    await waitFor(() => {
      expect(asked.analytics).toHaveLength(1);
    });
    controller.abort();
    held.release();

    await expect(loading).rejects.toMatchObject({ name: 'AbortError' });
    expect(asked).toEqual({ analytics: ['tech_interview'], api: [] });
  });
});
