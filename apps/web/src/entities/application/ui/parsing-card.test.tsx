import { buildJobStatus } from '@jobflow/shared/testing';
import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { errorReply, recordSentRequests } from '@/test/api-handlers';
import { fakeTimeoutsAndIntervals } from '@/test/fake-timeouts';
import { jobRoute } from '@/test/job-fixtures';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import { renderViewInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import type { ApplicationCardContext } from '../model/card-context';
import { FULL_CARD } from '../model/card-specimens';
import { jobKeys } from '../model/keys';
import { ApplicationCard } from './application-card';
import { ParsingCard, type ParsingCardProps } from './parsing-card';

const JOB_ID = '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a2b';

const CONTEXT: ApplicationCardContext = {
  now: new Date('2026-10-23T09:00:00.000Z'),
  timeZone: 'Europe/Kyiv',
};

const QUEUED: ParsingCardProps['parse'] = { aiStatus: 'queued', aiJobId: JOB_ID };

const PROCESSING: ParsingCardProps['parse'] = { aiStatus: 'processing', aiJobId: JOB_ID };

function Many({ count }: Readonly<{ count: number }>) {
  const ids = Array.from({ length: count }, (_, slot) => `card-${String(slot)}`);
  return ids.map((id) => <ParsingCard key={id} parse={PROCESSING} />);
}

function moving(container: HTMLElement) {
  return {
    bars: container.querySelectorAll('[class*="animate-shimmer"]').length,
    dots: container.querySelectorAll('.motion-safe\\:animate-pulse').length,
  };
}

function statusLine(): string | null {
  return screen.getByRole('status').textContent;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ParsingCard', () => {
  it('a processing draft reads step 2 of 3 and asks the job route nothing', () => {
    const sentRequests = recordSentRequests();
    renderViewInApp(<ParsingCard parse={PROCESSING} />);

    expect(statusLine()).toBe('AI обробляє · крок 2 з 3');
    expect(sentRequests()).toEqual([]);
  });

  it('a queued draft reads у черзі, then its wait once the job route answers', async () => {
    const jobs = jobRoute({ job: () => buildJobStatus({ queue: { ahead: 3, etaSeconds: 120 } }) });
    server.use(jobs.handler);
    renderViewInApp(<ParsingCard parse={QUEUED} />);

    expect(statusLine()).toBe('у черзі');
    expect(await screen.findByText('у черзі · ~2 хв')).toBe(screen.getByRole('status'));
    expect(jobs.sent).toEqual([JOB_ID]);
  });

  it('a queued draft asks for its wait again every 10 s', async () => {
    fakeTimeoutsAndIntervals();
    const waits = [120, 45];
    const jobs = jobRoute({
      job: () => buildJobStatus({ queue: { ahead: 1, etaSeconds: waits.shift() ?? 0 } }),
    });
    server.use(jobs.handler);
    renderViewInApp(<ParsingCard parse={QUEUED} />);
    await screen.findByText('у черзі · ~2 хв');

    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(await screen.findByText('у черзі · ~45 с')).toBeDefined();
    expect(jobs.sent).toEqual([JOB_ID, JOB_ID]);
  });

  it('a queued draft whose job route fails keeps the plain у черзі', async () => {
    const jobs = jobRoute({
      job: () => buildJobStatus(),
      reply: () => errorReply({ status: 404, type: 'not_found' }),
    });
    server.use(jobs.handler);
    renderViewInApp(
      <>
        <ParsingCard parse={QUEUED} />
        <QueryProbe queryKey={jobKeys.detail(JOB_ID)} />
      </>,
    );

    await waitForQuery({ queryKey: jobKeys.detail(JOB_ID), status: 'error' });

    expect(screen.getByText('у черзі').getAttribute('role')).toBe('status');
  });

  it('a queued draft with no job id reads у черзі and asks nothing', () => {
    const sentRequests = recordSentRequests();
    renderViewInApp(<ParsingCard parse={{ aiStatus: 'queued', aiJobId: null }} />);

    expect(statusLine()).toBe('у черзі');
    expect(sentRequests()).toEqual([]);
  });

  it('19 parsing cards shimmer and pulse, the 20th stills every bar and dot, and 19 move again', () => {
    const { view } = renderViewInApp(<Many count={19} />);
    expect(moving(view.container)).toEqual({ bars: 38, dots: 19 });

    view.rerender(<Many count={20} />);
    expect(moving(view.container)).toEqual({ bars: 0, dots: 0 });

    view.rerender(<Many count={19} />);
    expect(moving(view.container)).toEqual({ bars: 38, dots: 19 });
  });
});

describe('ApplicationCard for a draft', () => {
  it('a draft still parsing shows the skeleton with its status and none of its fields', () => {
    renderViewInApp(
      <ApplicationCard
        application={{ ...FULL_CARD, isDraft: true, aiStatus: 'processing' }}
        context={CONTEXT}
      />,
    );

    expect(statusLine()).toBe('AI обробляє · крок 2 з 3');
    expect(screen.queryByText('Senior Frontend Engineer')).toBeNull();
  });

  it('a draft whose parse is done shows its fields under перевір поля, ringed in accent', () => {
    renderViewInApp(
      <ApplicationCard
        application={{ ...FULL_CARD, isDraft: true, aiStatus: 'done' }}
        context={CONTEXT}
      />,
    );

    expect(screen.getByText('перевір поля')).toBeDefined();
    expect(screen.getByRole('article').className).toContain('inset-ring-accent/25');
    expect(screen.getByText('Senior Frontend Engineer')).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each([
    { isDraft: true, aiStatus: 'failed' },
    { isDraft: false, aiStatus: 'done' },
    { isDraft: false, aiStatus: 'queued' },
  ] as const)(
    'a card with isDraft $isDraft and AI status $aiStatus stays the usual card with no draft mark',
    (draft) => {
      renderViewInApp(
        <ApplicationCard application={{ ...FULL_CARD, ...draft }} context={CONTEXT} />,
      );

      expect(screen.getByText('Senior Frontend Engineer')).toBeDefined();
      expect(screen.queryByText('перевір поля')).toBeNull();
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.getByRole('article').className).not.toContain('inset-ring-accent/25');
    },
  );
});
