import { useQueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { timelineKeys } from '@/entities/application';
import { errorReply } from '@/test/api-handlers';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';
import { DESIGN_TIMELINE_APPLICATION, timelineRoute } from '@/test/timeline-fixtures';

import { useApplicationTimeline } from './use-application-timeline';

const TIMELINE_KEY = timelineKeys.detail(DESIGN_TIMELINE_APPLICATION.id);

const NOT_FOUND = () => errorReply({ status: 404, type: 'not_found' });

function renderTimeline() {
  const { result } = renderHookInApp(() => ({
    timeline: useApplicationTimeline(DESIGN_TIMELINE_APPLICATION),
    status: useQueryClient().getQueryState(TIMELINE_KEY)?.status,
  }));
  return result;
}

describe('useApplicationTimeline', () => {
  it('counts every item, folds the AI parse and waits by the user silence threshold', async () => {
    server.use(meRoute({ silenceDays: 12 }), timelineRoute());
    const result = renderTimeline();

    expect(result.current.timeline.load.pending).toBe(true);
    await waitFor(() => {
      expect(result.current.timeline.waiting?.meta).toBe(
        '4 дні тиші. Поріг фоллоу-апу — 12 днів, нагадаємо 15.09.',
      );
    });
    await waitFor(() => {
      expect(result.current.timeline.count).toBe(9);
    });
    expect(result.current.timeline.rows).toHaveLength(8);
    expect(result.current.timeline.load).toMatchObject({ pending: false, failed: false });
  });

  it('a timeline that fails before any data arrives offers a retry', async () => {
    server.use(meRoute(), timelineRoute({ reply: NOT_FOUND }));
    const result = renderTimeline();

    await waitFor(() => {
      expect(result.current.timeline.load).toMatchObject({ pending: false, failed: true });
    });
    expect(result.current.timeline.rows).toEqual([]);
  });

  it('a failed refetch keeps the rows already on screen and shows no failure', async () => {
    server.use(meRoute(), timelineRoute());
    const result = renderTimeline();
    await waitFor(() => {
      expect(result.current.timeline.rows).toHaveLength(8);
    });
    server.use(timelineRoute({ reply: NOT_FOUND }));

    act(() => {
      result.current.timeline.load.onRetry();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.timeline.rows).toHaveLength(8);
    expect(result.current.timeline.load.failed).toBe(false);
  });
});
