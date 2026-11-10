import type { ApplicationResponse, JobStatus } from '@jobflow/shared';
import { buildJobStatus } from '@jobflow/shared/testing';
import { screen, waitFor } from '@testing-library/react';
import { delay, type HttpResponseResolver } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_CLIENT_LIMITS } from '@/shared/api';
import { errorReply } from '@/test/api-handlers';
import { applicationRoute, confirmRoute, REVIEW_DRAFT } from '@/test/application-fixtures';
import { advanceBy, fakeTimeoutsAndIntervals } from '@/test/fake-timeouts';
import { jobRoute } from '@/test/job-fixtures';
import { bringLiveStreamUp, closeLiveStreams } from '@/test/live-stream';
import { push } from '@/test/navigation';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { CaptureProgress } from './capture-progress';

vi.mock('next/link', () => import('@/test/link'));
vi.mock('next/navigation', () => import('@/test/navigation'));

type ProgressSetup = {
  job?: () => JobStatus;
  jobReply?: HttpResponseResolver;
  application?: ApplicationResponse;
  applicationReply?: HttpResponseResolver;
  jobId?: string | null;
};

const JOB_ID = '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a2b';

const QUEUED = buildJobStatus();

const PROCESSING = buildJobStatus({ status: 'processing', step: 2, queue: null });

const DONE = buildJobStatus({ status: 'done', step: 3, queue: null });

const FAILED = buildJobStatus({ status: 'failed', step: 2, queue: null, errorType: 'timeout' });

const LOADING_LINE = 'крок 1 з 3 · обробляється';

const PROCESSING_LINE = 'крок 2 з 3 · обробляється';

const ON_BOARD = 'Картка вже на дошці';

const REVIEW = 'Перевір поля і готово';

const FAILED_LINE = 'AI не впорався';

const RETRIED = { timeout: 2500 };

function renderProgress({
  job = () => QUEUED,
  jobReply,
  application = REVIEW_DRAFT,
  applicationReply,
  jobId = JOB_ID,
}: ProgressSetup = {}) {
  const jobs = jobRoute({ job, ...(jobReply && { reply: jobReply }) });
  const detail = applicationRoute({
    application,
    ...(applicationReply && { reply: applicationReply }),
  });
  const confirms = confirmRoute();
  server.use(jobs.handler, detail.handler, confirms.handler);
  const user = renderInApp(<CaptureProgress capture={{ applicationId: application.id, jobId }} />);
  return { user, jobReads: jobs.sent, detailReads: detail.sent, confirms: confirms.sent };
}

function panelHeading(name: string): HTMLElement {
  return screen.getByRole('heading', { level: 3, name });
}

async function findIdleExplainer(): Promise<HTMLElement> {
  await waitFor(() => {
    expect(screen.queryByRole('status')).toBeNull();
  });
  return panelHeading(ON_BOARD);
}

describe('CaptureProgress', () => {
  afterEach(() => {
    closeLiveStreams();
    push.mockClear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('a queued parse shows its place and its wait over the explainer, and the skeleton card in the column', async () => {
    const { detailReads } = renderProgress();

    expect(await screen.findByText('у черзі · 2 задачі перед твоєю · ~30 с')).toBeDefined();
    expect(await screen.findByText('у черзі · ~30 с')).toBeDefined();
    expect(panelHeading(ON_BOARD)).toBeDefined();
    expect(detailReads).toEqual([]);
  });

  it('a running parse shows step 2 of 3 in the panel and on the skeleton card', async () => {
    renderProgress({ job: () => PROCESSING });

    expect(await screen.findByText(PROCESSING_LINE)).toBeDefined();
    expect(screen.getByText('AI обробляє · крок 2 з 3')).toBeDefined();
  });

  it('with the stream down the job is asked again after 2 s', async () => {
    fakeTimeoutsAndIntervals();
    const { jobReads } = renderProgress({ job: () => PROCESSING });
    await screen.findByText(PROCESSING_LINE);

    await advanceBy(1900);
    expect(jobReads).toHaveLength(1);
    await advanceBy(100);

    await waitFor(() => {
      expect(jobReads).toHaveLength(2);
    });
  });

  it('with the stream up the job is asked again only after 10 s', async () => {
    fakeTimeoutsAndIntervals();
    await bringLiveStreamUp();
    const { jobReads } = renderProgress({ job: () => PROCESSING });
    await screen.findByText(PROCESSING_LINE);

    await advanceBy(8000);
    expect(jobReads).toHaveLength(1);
    await advanceBy(2000);

    await waitFor(() => {
      expect(jobReads).toHaveLength(2);
    });
  });

  it('a finished parse reads the card once, opens the review with the перевір поля card, and stops asking', async () => {
    fakeTimeoutsAndIntervals();
    const parse = { job: PROCESSING };
    const { jobReads, detailReads } = renderProgress({ job: () => parse.job });
    await screen.findByText(PROCESSING_LINE);
    expect(detailReads).toEqual([]);

    parse.job = DONE;
    await advanceBy(2000);

    expect(await screen.findByRole('form', { name: REVIEW })).toBeDefined();
    expect(panelHeading(REVIEW)).toBeDefined();
    expect(screen.getByText('крок 3 з 3 · розпізнано')).toBeDefined();
    expect(screen.getByText('перевір поля')).toBeDefined();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Компанія' }).value).toBe('Acme');
    expect(detailReads).toEqual([REVIEW_DRAFT.id]);
    const asked = jobReads.length;
    await advanceBy(30_000);
    expect(jobReads).toHaveLength(asked);
  });

  it('a draft opened by its link shows the review without asking for a job, and the confirmation leads to the board', async () => {
    const { user, jobReads, confirms } = renderProgress({ jobId: null });

    await user.click(await screen.findByRole('button', { name: 'Підтвердити і на дошку' }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/board');
    });
    expect(confirms).toEqual([REVIEW_DRAFT.id]);
    expect(jobReads).toEqual([]);
  });

  it('a parsed card that is no draft any more offers the board and the card instead of the review', async () => {
    renderProgress({ job: () => DONE, application: { ...REVIEW_DRAFT, isDraft: false } });

    expect(await screen.findByRole('heading', { level: 3, name: 'Картка готова' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'До дошки' }).getAttribute('href')).toBe('/board');
    expect(screen.getByRole('link', { name: 'Відкрити картку' }).getAttribute('href')).toBe(
      `/applications/${REVIEW_DRAFT.id}`,
    );
    expect(screen.getByText('Senior React developer')).toBeDefined();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('a failed parse says so, keeps the data safe line and offers no actions', async () => {
    const { detailReads } = renderProgress({ job: () => FAILED });

    expect(await screen.findByText(FAILED_LINE)).toBeDefined();
    expect(screen.getByText('Дані цілі, нічого не втрачено.')).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
    expect(detailReads).toEqual([]);
  });

  it('a parse output the form cannot read shows the failed state', async () => {
    renderProgress({
      job: () => DONE,
      application: { ...REVIEW_DRAFT, aiParsed: { company: 'Acme' } },
    });

    expect(await screen.findByText(FAILED_LINE)).toBeDefined();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('a card request the server fails shows the failed state', async () => {
    renderProgress({
      job: () => DONE,
      applicationReply: () => errorReply({ status: 500, type: 'internal_error' }),
    });

    expect(await screen.findByText(FAILED_LINE, {}, RETRIED)).toBeDefined();
  });

  it('a card that is gone brings the explainer back', async () => {
    renderProgress({
      jobId: null,
      applicationReply: () => errorReply({ status: 404, type: 'not_found' }),
    });

    expect(await findIdleExplainer()).toBeDefined();
    expect(screen.queryByText(FAILED_LINE)).toBeNull();
  });

  it('a draft opened by its link before any parse shows the explainer', async () => {
    renderProgress({ jobId: null, application: { ...REVIEW_DRAFT, aiParsed: null } });

    expect(await findIdleExplainer()).toBeDefined();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('a job request that never answers stays on the loading line, is dropped at the client timeout and ends in the failed state', async () => {
    fakeTimeoutsAndIntervals();
    const { jobReads } = renderProgress({ jobReply: () => delay('infinite') });
    expect(await screen.findByText(LOADING_LINE)).toBeDefined();

    await advanceBy(API_CLIENT_LIMITS.requestTimeoutMs - 1);
    expect(jobReads).toHaveLength(1);
    await advanceBy(1001);
    await waitFor(() => {
      expect(jobReads).toHaveLength(2);
    });
    expect(screen.getByText(LOADING_LINE)).toBeDefined();
    await advanceBy(API_CLIENT_LIMITS.requestTimeoutMs);

    expect(await screen.findByText(FAILED_LINE)).toBeDefined();
  });
});
