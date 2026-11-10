import type { ApplicationResponse, JobStatus } from '@jobflow/shared';
import { buildJobStatus } from '@jobflow/shared/testing';
import { screen, waitFor, within } from '@testing-library/react';
import { delay, type HttpResponseResolver } from 'msw';
import { HttpResponse } from 'msw/http';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_CLIENT_LIMITS } from '@/shared/api';
import { TWO_MINUTES } from '@/test/add-fixtures';
import { errorReply, rateLimitedReply } from '@/test/api-handlers';
import {
  applicationRoute,
  confirmRoute,
  deleteRoute,
  FAILED_DRAFT,
  retryRoute,
  REVIEW_DRAFT,
  updateRoute,
} from '@/test/application-fixtures';
import type { MoveRouteOptions } from '@/test/board-fixtures';
import { advanceBy, fakeTimeoutsAndIntervals } from '@/test/fake-timeouts';
import { descriptionOf } from '@/test/field-description';
import { failedJob, jobRoute, type JobRouteOptions } from '@/test/job-fixtures';
import { latch } from '@/test/latch';
import { bringLiveStreamUp, closeLiveStreams } from '@/test/live-stream';
import { push } from '@/test/navigation';
import { renderViewInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { CaptureProgress } from './capture-progress';

vi.mock('next/link', () => import('@/test/link'));
vi.mock('next/navigation', () => import('@/test/navigation'));

type ProgressSetup = {
  job?: JobRouteOptions['job'];
  jobReply?: HttpResponseResolver;
  application?: ApplicationResponse;
  applicationReply?: HttpResponseResolver;
  jobId?: string | null;
  retry?: MoveRouteOptions;
};

type Outage = { down: boolean };

type OutageReplies = { down: HttpResponseResolver; up: HttpResponseResolver };

type PolledOutage = { outage: Outage; jobReads: readonly string[] };

const JOB_ID = '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a2b';

const RETRIED_JOB_ID = '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a2c';

const QUEUED = buildJobStatus();

const PROCESSING = buildJobStatus({ status: 'processing', step: 2, queue: null });

const DONE = buildJobStatus({ status: 'done', step: 3, queue: null });

const FAILED = failedJob('ai_timeout');

const QUEUED_LINE = 'у черзі · 2 задачі перед твоєю · ~30 с';

const LOADING_LINE = 'крок 1 з 3 · обробляється';

const PROCESSING_LINE = 'крок 2 з 3 · обробляється';

const ON_BOARD = 'Картка вже на дошці';

const REVIEW = 'Перевір поля і готово';

const FAILED_LINE = 'AI не впорався';

const READ_FAILED = 'Не вдалося завантажити';

const NO_FIELDS =
  'У тексті не було ні назви компанії, ні позиції, схоже, скопіювався тільки блок вимог.';

const TIMEOUT = 'AI не встиг відповісти. Це збій на нашому боці, з текстом усе гаразд.';

const BUDGET =
  'Ліміт AI-розборів вичерпано, тому цей текст AI не читав. Повторити розбір вийде, коли ліміт оновиться.';

const PROVIDER_DOWN = 'Сервіс AI зараз недоступний. Це збій на нашому боці, з текстом усе гаразд.';

const GENERIC = 'AI не зміг розібрати цей текст.';

const KEPT = 'Текст цілим лежить у нотатці картки.';

const NEXT =
  "Заповни два поля, і картка стане повноцінною; Match Score порахується, коли з'явиться позиція.";

const FAILURES = [
  { errorType: 'no_company_no_position', reason: NO_FIELDS },
  { errorType: 'ai_timeout', reason: TIMEOUT },
  { errorType: 'budget_exceeded', reason: BUDGET },
  { errorType: 'not_ready', reason: PROVIDER_DOWN },
  { errorType: 'ai_provider_error', reason: PROVIDER_DOWN },
  { errorType: 'rate_limited', reason: PROVIDER_DOWN },
  { errorType: 'ai_invalid_output', reason: GENERIC },
  { errorType: null, reason: GENERIC },
];

const MANUAL = 'Заповнити вручну';

const RETRY = 'Спробувати ще раз';

const DELETE = 'Видалити картку';

const CONFIRM = 'Підтвердити і на дошку';

const MANUAL_FORM = 'Заповни компанію і позицію';

const DELETE_DIALOG = { name: 'Видалити картку?' } as const;

const SAVE_FAILED_TOAST = 'Це збій на нашому боці, збережені дані на місці. Спробуй ще раз.';

const RETRIED = { timeout: 2500 };

const POLLED = { timeout: 4000 };

function renderProgress({
  job = () => QUEUED,
  jobReply,
  application = REVIEW_DRAFT,
  applicationReply,
  jobId = JOB_ID,
  retry = {},
}: ProgressSetup = {}) {
  const jobs = jobRoute({ job, ...(jobReply && { reply: jobReply }) });
  const detail = applicationRoute({
    application,
    ...(applicationReply && { reply: applicationReply }),
  });
  const routes = {
    confirms: confirmRoute(),
    updates: updateRoute({ application }),
    retries: retryRoute({ ...retry, jobId: RETRIED_JOB_ID }),
    deletes: deleteRoute(),
  };
  server.use(jobs.handler, detail.handler, ...Object.values(routes).map((route) => route.handler));
  const actions = { onRetried: vi.fn<(id: string) => void>(), onDeleted: vi.fn<() => void>() };
  const progressOf = (id: string | null) => (
    <CaptureProgress capture={{ applicationId: application.id, jobId: id }} actions={actions} />
  );
  const { user, view } = renderViewInApp(progressOf(jobId));
  actions.onRetried.mockImplementation((retried) => {
    view.rerender(progressOf(retried));
  });
  return {
    user,
    actions,
    jobReads: jobs.sent,
    detailReads: detail.sent,
    confirms: routes.confirms.sent,
    updates: routes.updates.sent,
    retries: routes.retries.sent,
    deletes: routes.deletes.sent,
  };
}

function renderFailed(setup: ProgressSetup = {}) {
  return renderProgress({ job: () => FAILED, application: FAILED_DRAFT, ...setup });
}

function during(outage: Outage, replies: OutageReplies): HttpResponseResolver {
  return (info) => (outage.down ? replies.down(info) : replies.up(info));
}

function processingReply(): Response {
  return HttpResponse.json({ ...PROCESSING, id: JOB_ID });
}

function panelHeading(name: string): HTMLElement {
  return screen.getByRole('heading', { level: 3, name });
}

function buttonLabels(): (string | null)[] {
  return screen.getAllByRole('button').map((button) => button.textContent);
}

async function findIdleExplainer(): Promise<HTMLElement> {
  await waitFor(() => {
    expect(screen.queryByRole('status')).toBeNull();
  });
  return panelHeading(ON_BOARD);
}

async function openManualForm(user: ReturnType<typeof renderFailed>['user']) {
  await user.click(await screen.findByRole('button', { name: MANUAL }));
  const form = within(await screen.findByRole('form', { name: MANUAL_FORM }));
  return {
    company: form.getByRole<HTMLInputElement>('textbox', { name: 'Компанія' }),
    position: form.getByRole<HTMLInputElement>('textbox', { name: 'Позиція' }),
    confirm: form.getByRole('button', { name: CONFIRM }),
  };
}

async function recoversByItself({ outage, jobReads }: PolledOutage) {
  expect(screen.queryByText(FAILED_LINE)).toBeNull();
  expect(jobReads).toHaveLength(2);
  await advanceBy(2000);
  await waitFor(() => {
    expect(jobReads).toHaveLength(3);
  });
  expect(screen.getByText(READ_FAILED)).toBeDefined();

  outage.down = false;
  await advanceBy(API_CLIENT_LIMITS.requestTimeoutMs + 3000);

  expect(await screen.findByText(PROCESSING_LINE)).toBeDefined();
  expect(screen.queryByText(READ_FAILED)).toBeNull();
}

describe('CaptureProgress', () => {
  afterEach(() => {
    toast.dismiss();
    closeLiveStreams();
    push.mockClear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('a queued parse shows its place and its wait over the explainer, and the skeleton card in the column', async () => {
    const { detailReads } = renderProgress();

    expect(await screen.findByText(QUEUED_LINE)).toBeDefined();
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

    await user.click(await screen.findByRole('button', { name: CONFIRM }));

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

  it('a failed parse reads the card, says so over the quoted text, marks the card потрібні поля and offers manual fill, retry and delete', async () => {
    const { detailReads } = renderFailed();

    expect(await screen.findByText(FAILED_LINE)).toBeDefined();
    expect(panelHeading('Картка створена, але порожня')).toBeDefined();
    expect(screen.getByText('Дані цілі, нічого не втрачено.')).toBeDefined();
    expect(
      screen.getByText('5+ years of experience, design patterns, Upper-Intermediate English')
        .tagName,
    ).toBe('BLOCKQUOTE');
    expect(screen.getByText('потрібні поля')).toBeDefined();
    expect(screen.getByText('текст збережено в нотатці')).toBeDefined();
    expect(buttonLabels()).toEqual([MANUAL, RETRY, DELETE]);
    expect(detailReads).toEqual([FAILED_DRAFT.id]);
  });

  it.each(FAILURES)(
    'a parse that failed with $errorType gives its own reason and says where the text is',
    async ({ errorType, reason }) => {
      renderFailed({ job: () => failedJob(errorType) });

      expect(await screen.findByText(`${reason} ${KEPT} ${NEXT}`)).toBeDefined();
      expect(screen.getByText(FAILED_LINE)).toBeDefined();
    },
  );

  it('a failed draft with no kept text shows no quote', async () => {
    renderFailed({ application: { ...FAILED_DRAFT, rawText: null } });

    expect(await screen.findByText(FAILED_LINE)).toBeDefined();
    expect(document.querySelector('blockquote')).toBeNull();
  });

  it('a draft the parse did fill opens the review even when the job in the link failed', async () => {
    renderProgress({ job: () => FAILED });

    expect(await screen.findByRole('form', { name: REVIEW })).toBeDefined();
    expect(screen.queryByText(FAILED_LINE)).toBeNull();
  });

  it('Спробувати ще раз posts one retry and stays busy on its way, then follows the new job with no retry button and opens the review once the card is parsed', async () => {
    const held = latch();
    const parse: { job: JobStatus; card: ApplicationResponse } = {
      job: QUEUED,
      card: FAILED_DRAFT,
    };
    const { user, retries, actions } = renderFailed({
      job: (id) => (id === RETRIED_JOB_ID ? parse.job : FAILED),
      applicationReply: () => HttpResponse.json(parse.card),
      retry: { latch: held },
    });

    await user.click(await screen.findByRole('button', { name: RETRY }));
    await waitFor(() => {
      expect(retries).toEqual([FAILED_DRAFT.id]);
    });
    expect(screen.getByRole('button', { name: RETRY }).getAttribute('aria-busy')).toBe('true');
    held.release();

    expect(await screen.findByText(QUEUED_LINE)).toBeDefined();
    expect(actions.onRetried).toHaveBeenCalledWith(RETRIED_JOB_ID);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: RETRY })).toBeNull();
    });
    expect(screen.queryByText(FAILED_LINE)).toBeNull();
    parse.job = DONE;
    parse.card = { ...REVIEW_DRAFT, id: FAILED_DRAFT.id };

    expect(await screen.findByRole('form', { name: REVIEW }, POLLED)).toBeDefined();
    expect(screen.queryByRole('heading', { level: 3, name: ON_BOARD })).toBeNull();
    expect(retries).toHaveLength(1);
  });

  it('a retry refused by the parse limit says how long to wait and keeps the failed state', async () => {
    const { user, actions } = renderFailed({
      retry: { reply: () => rateLimitedReply(TWO_MINUTES) },
    });

    await user.click(await screen.findByRole('button', { name: RETRY }));

    expect(
      await screen.findByText('Спробуй через 2 хв. Усе введене лишилось у формі.'),
    ).toBeDefined();
    expect(screen.getByText('Забагато розборів за годину')).toBeDefined();
    expect(screen.getByText(FAILED_LINE)).toBeDefined();
    expect(actions.onRetried).not.toHaveBeenCalled();
  });

  it('a retry the server refuses for another reason shows the save failure and reads the card again', async () => {
    const { user, detailReads, actions } = renderFailed({
      retry: { reply: () => errorReply({ status: 409, type: 'conflict' }) },
    });

    await user.click(await screen.findByRole('button', { name: RETRY }));

    expect(await screen.findByText(SAVE_FAILED_TOAST)).toBeDefined();
    await waitFor(() => {
      expect(detailReads).toHaveLength(2);
    });
    expect(actions.onRetried).not.toHaveBeenCalled();
  });

  it('Заповнити вручну opens the form in the company field with both names empty, and an empty confirmation marks them and sends nothing', async () => {
    const { user, updates, confirms } = renderFailed();

    const { company, position, confirm } = await openManualForm(user);

    expect(company.value).toBe('');
    expect(position.value).toBe('');
    expect(document.activeElement).toBe(company);
    expect(screen.getByText('потрібні поля')).toBeDefined();
    expect(screen.queryByRole('form', { name: REVIEW })).toBeNull();
    await user.click(confirm);
    await waitFor(() => {
      expect(descriptionOf(company)).toBe('Вкажи компанію одним коротким рядком');
    });
    expect(descriptionOf(position)).toBe('Вкажи посаду одним коротким рядком');
    expect(updates).toEqual([]);
    expect(confirms).toEqual([]);
  });

  it('a manual fill with both names typed saves them, confirms the draft and leads to the board', async () => {
    const { user, updates, confirms } = renderFailed();
    const { company, position, confirm } = await openManualForm(user);
    await user.type(company, 'Kvit');
    await user.type(position, 'Middle QA');

    await user.click(confirm);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/board');
    });
    expect(updates).toEqual([{ company: 'Kvit', position: 'Middle QA' }]);
    expect(confirms).toEqual([FAILED_DRAFT.id]);
  });

  it('Видалити картку asks first: Скасувати keeps the failed state, Видалити sends one DELETE and reports the card gone', async () => {
    const { user, deletes, actions } = renderFailed();

    await user.click(await screen.findByRole('button', { name: DELETE }));
    const asked = within(screen.getByRole('dialog', DELETE_DIALOG));
    await user.click(asked.getByRole('button', { name: 'Скасувати' }));
    expect(deletes).toEqual([]);
    expect(screen.getByText(FAILED_LINE)).toBeDefined();
    expect(actions.onDeleted).not.toHaveBeenCalled();

    await user.click(await screen.findByRole('button', { name: DELETE }));
    const again = within(await screen.findByRole('dialog', DELETE_DIALOG));
    await user.click(again.getByRole('button', { name: 'Видалити' }));

    await waitFor(() => {
      expect(actions.onDeleted).toHaveBeenCalledTimes(1);
    });
    expect(deletes).toEqual([FAILED_DRAFT.id]);
  });

  it('Escape on the delete question closes it, sends nothing and hands the focus back to Видалити картку', async () => {
    const { user, deletes } = renderFailed();
    const opener = await screen.findByRole('button', { name: DELETE });

    await user.click(opener);
    await screen.findByRole('dialog', DELETE_DIALOG);
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(document.activeElement).toBe(opener);
    expect(deletes).toEqual([]);
  });

  it('a parse output the form cannot read shows the failed state with the general reason, manual fill and delete, and no retry', async () => {
    renderProgress({
      job: () => DONE,
      application: { ...REVIEW_DRAFT, aiParsed: { company: 'Acme' } },
    });

    expect(await screen.findByText(FAILED_LINE)).toBeDefined();
    expect(screen.getByText(`${GENERIC} ${NEXT}`)).toBeDefined();
    expect(buttonLabels()).toEqual([MANUAL, DELETE]);
    expect(screen.queryByText('текст збережено в нотатці')).toBeNull();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('a card request the server fails shows the load failure instead of the AI failure, and its button reads the card again', async () => {
    const outage = { down: true };
    const { user, detailReads } = renderProgress({
      job: () => DONE,
      applicationReply: during(outage, {
        down: () => errorReply({ status: 500, type: 'internal_error' }),
        up: () => HttpResponse.json(REVIEW_DRAFT),
      }),
    });

    expect(await screen.findByText(READ_FAILED, {}, RETRIED)).toBeDefined();
    expect(screen.queryByText(FAILED_LINE)).toBeNull();
    expect(detailReads).toHaveLength(2);
    outage.down = false;
    await user.click(screen.getByRole('button', { name: RETRY }));

    expect(await screen.findByRole('form', { name: REVIEW })).toBeDefined();
    expect(detailReads).toHaveLength(3);
  });

  it('a card that is gone brings the explainer back', async () => {
    renderProgress({
      jobId: null,
      applicationReply: () => errorReply({ status: 404, type: 'not_found' }),
    });

    expect(await findIdleExplainer()).toBeDefined();
    expect(screen.queryByText(FAILED_LINE)).toBeNull();
    expect(screen.queryByText(READ_FAILED)).toBeNull();
  });

  it('a draft opened by its link before any parse shows the explainer', async () => {
    renderProgress({ jobId: null, application: { ...REVIEW_DRAFT, aiParsed: null } });

    expect(await findIdleExplainer()).toBeDefined();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('a job request that never answers stays on the loading line, is dropped at the client timeout and ends in the load failure, then is asked again and recovers with no click', async () => {
    fakeTimeoutsAndIntervals();
    const outage = { down: true };
    const { jobReads } = renderProgress({
      jobReply: during(outage, { down: () => delay('infinite'), up: processingReply }),
    });
    expect(await screen.findByText(LOADING_LINE)).toBeDefined();

    await advanceBy(API_CLIENT_LIMITS.requestTimeoutMs - 1);
    expect(jobReads).toHaveLength(1);
    await advanceBy(1001);
    await waitFor(() => {
      expect(jobReads).toHaveLength(2);
    });
    expect(screen.getByText(LOADING_LINE)).toBeDefined();
    await advanceBy(API_CLIENT_LIMITS.requestTimeoutMs);

    expect(await screen.findByText(READ_FAILED)).toBeDefined();
    await recoversByItself({ outage, jobReads });
  });

  it('a job request the network refuses ends in the load failure, then is asked again and recovers with no click', async () => {
    fakeTimeoutsAndIntervals();
    const outage = { down: true };
    const { jobReads } = renderProgress({
      jobReply: during(outage, { down: () => HttpResponse.error(), up: processingReply }),
    });

    expect(await screen.findByText(READ_FAILED, {}, RETRIED)).toBeDefined();
    await recoversByItself({ outage, jobReads });
  });
});
