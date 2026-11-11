import { buildJobStatus } from '@jobflow/shared/testing';
import { screen, waitFor, within } from '@testing-library/react';
import type { RequestHandler } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AddQuery } from '@/features/add-application';
import { addRoutes, FIRST_PASTE, linkField, textField, TIMEOUT_REASON } from '@/test/add-fixtures';
import { apiUrl, recordSentRequests } from '@/test/api-handlers';
import {
  applicationRoute,
  confirmRoute,
  deleteRoute,
  FAILED_DRAFT,
  retryRoute,
  REVIEW_DRAFT,
} from '@/test/application-fixtures';
import { axeViolations } from '@/test/axe';
import { captureTokenRoutes } from '@/test/capture-token-fixtures';
import { DONE_JOB, failedJob, jobRoute, PROCESSING_JOB } from '@/test/job-fixtures';
import { push } from '@/test/navigation';
import { renderViewInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import { AddApplicationPage } from './add-application-page';

vi.mock('next/link', () => import('@/test/link'));
vi.mock('next/navigation', () => import('@/test/navigation'));

const MARKUP = '<b>Senior QA</b> <img src=x onerror=alert(1)> Kvit шукає тестувальника';

const HEADINGS = [
  'Один клік зі сторінки вакансії',
  'Вставити опис вакансії',
  'Заповнити самому',
  'Обробка йде у фоні',
];

const MANUAL_NOTE =
  "Обов'язкові тільки компанія і позиція. Match Score у такої картки не буде, і це нормально.";

const CONFIRM = 'Підтвердити і на дошку';

const REVIEW = 'Перевір поля і готово';

const POLLED = { timeout: 3000 };

const ON_BOARD = 'Картка вже на дошці';

const FAILED_TITLE = 'Картка створена, але порожня';

const FAILED_JOB = failedJob('ai_timeout');

const RETRIED_JOB_ID = '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a3d';

const FAILED_ADDRESS = `/add?review=${FAILED_DRAFT.id}&job=${FAILED_JOB.id}#review`;

function addressNow(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

async function renderPage(query: AddQuery = {}, handlers: readonly RequestHandler[] = []) {
  const added = addRoutes();
  server.use(meRoute(), ...captureTokenRoutes().handlers, ...added.handlers, ...handlers);
  const sentRequests = recordSentRequests();
  const { user, view } = renderViewInApp(<AddApplicationPage query={query} />);
  await screen.findByRole('button', { name: 'Створити кнопку' });
  return { user, view, sentRequests, sent: added.sent };
}

async function renderFailedPage(query: AddQuery = { job: FAILED_JOB.id }) {
  const jobs = jobRoute({
    job: (id) => (id === RETRIED_JOB_ID ? buildJobStatus() : FAILED_JOB),
    owner: FAILED_DRAFT.id,
  });
  const retries = retryRoute({ jobId: RETRIED_JOB_ID });
  const deletes = deleteRoute();
  const page = await renderPage({ review: FAILED_DRAFT.id, ...query }, [
    jobs.handler,
    applicationRoute({ application: FAILED_DRAFT }).handler,
    retries.handler,
    deletes.handler,
  ]);
  return { ...page, jobs, retries, deletes };
}

function cardReadsOf(sentRequests: ReturnType<typeof recordSentRequests>) {
  return sentRequests().filter(
    ({ url }) => typeof url === 'string' && url.startsWith(apiUrl('/applications/')),
  );
}

describe('AddApplicationPage', () => {
  afterEach(() => {
    push.mockClear();
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('offers the bookmarklet, the paste form and the manual form under one heading', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Три способи додати відгук');
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(HEADINGS);
    expect(screen.getByText(MANUAL_NOTE)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Розібрати текст' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Створити картку' })).toBeDefined();
    expect(document.activeElement).toBe(document.body);
  });

  it('the bookmarklet fallback query fills the paste form as plain text and sends nothing', async () => {
    const { sentRequests, sent } = await renderPage({
      text: MARKUP,
      url: 'https://djinni.co/jobs/1',
    });

    expect(textField().value).toBe(MARKUP);
    expect(linkField().value).toBe('https://djinni.co/jobs/1');
    expect(document.querySelector('b, img')).toBeNull();
    expect(document.activeElement).toBe(textField());
    expect(sentRequests().filter(({ method }) => method !== 'GET')).toEqual([]);
    expect(sent).toEqual({ pasted: [], created: [] });
  });

  it('a javascript: url in the query never reaches the link field', async () => {
    await renderPage({ text: 'Kvit шукає QA', url: 'javascript:alert(1)' });

    expect(textField().value).toBe('Kvit шукає QA');
    expect(linkField().value).toBe('');
  });

  it('path=paste puts the focus in the empty text field', async () => {
    await renderPage({ path: 'paste' });

    expect(textField().value).toBe('');
    expect(document.activeElement).toBe(textField());
  });

  it.each<{ name: string; query: AddQuery }>([
    { name: 'a page opened without it', query: {} },
    { name: 'a page already opened with it', query: { path: 'paste' } },
  ])(
    'path=paste arriving on $name moves the focus to the text field and keeps the typed text',
    async ({ query }) => {
      const { user, view } = await renderPage(query);
      await user.type(textField(), 'Kvit шукає QA');
      await user.click(screen.getByRole('textbox', { name: 'Компанія' }));

      view.rerender(<AddApplicationPage query={{ path: 'paste' }} />);

      await waitFor(() => {
        expect(document.activeElement).toBe(textField());
      });
      expect(textField().value).toBe('Kvit шукає QA');
    },
  );

  it('a pasted vacancy brings the live panel into view, then its review, and the confirmation leads to the board', async () => {
    const parse = { job: PROCESSING_JOB };
    const jobs = jobRoute({ job: () => parse.job, owner: FIRST_PASTE.applicationId });
    const draft = { ...REVIEW_DRAFT, id: FIRST_PASTE.applicationId };
    const confirms = confirmRoute();
    const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { user } = await renderPage({}, [
      jobs.handler,
      applicationRoute({ application: draft }).handler,
      confirms.handler,
    ]);

    await user.click(textField());
    await user.paste('Acme hires a Senior React developer');
    await user.click(screen.getByRole('button', { name: 'Розібрати текст' }));

    const line = await screen.findByText('крок 2 з 3 · обробляється');
    expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' });
    expect(
      scrolled.mock.contexts.filter((target) => target instanceof Element && target.contains(line)),
    ).toHaveLength(1);
    expect(jobs.sent[0]).toBe(FIRST_PASTE.jobId);
    parse.job = DONE_JOB;
    await user.click(await screen.findByRole('button', { name: CONFIRM }, POLLED));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/board');
    });
    expect(confirms.sent).toEqual([FIRST_PASTE.applicationId]);
  });

  it('review=<draft id> opens the review of that draft and leaves the paste field alone', async () => {
    await renderPage({ review: REVIEW_DRAFT.id, path: 'paste' }, [
      applicationRoute({ application: REVIEW_DRAFT }).handler,
    ]);

    const review = within(await screen.findByRole('form', { name: REVIEW }));
    expect(review.getByRole<HTMLInputElement>('textbox', { name: 'Позиція' }).value).toBe(
      'Senior React developer',
    );
    expect(document.activeElement).toBe(document.body);
  });

  it('review=<draft id> followed by an address with no review closes that review and brings the explainer back', async () => {
    const { view } = await renderPage({ review: REVIEW_DRAFT.id }, [
      applicationRoute({ application: REVIEW_DRAFT }).handler,
    ]);
    await screen.findByRole('form', { name: REVIEW });

    view.rerender(<AddApplicationPage query={{}} />);

    expect(await screen.findByRole('heading', { level: 3, name: ON_BOARD })).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByRole('form', { name: REVIEW })).toBeNull();
    });
  });

  it('review=<failed draft id>&job=<job id> asks that job and opens the AI failure with its reason and no accessibility violations', async () => {
    const { jobs } = await renderFailedPage();

    expect(await screen.findByText('AI не впорався')).toBeDefined();
    expect(screen.getByRole('heading', { level: 3, name: FAILED_TITLE })).toBeDefined();
    expect(screen.getByText(TIMEOUT_REASON, { exact: false })).toBeDefined();
    expect(jobs.sent).toEqual([FAILED_JOB.id]);
    expect(await axeViolations()).toEqual([]);
  });

  it('a job id that is no id is dropped: the failed draft shows the explainer and no job is asked', async () => {
    const { jobs } = await renderFailedPage({ job: 'garbage' });

    expect(await screen.findByRole('heading', { level: 3, name: ON_BOARD })).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
    expect(jobs.sent).toEqual([]);
  });

  it('a retried parse keeps the card, follows the new job and puts it in the address in place of the failed one', async () => {
    window.history.replaceState(null, '', FAILED_ADDRESS);
    const { user, jobs, retries } = await renderFailedPage();

    await user.click(await screen.findByRole('button', { name: 'Спробувати ще раз' }));

    expect(await screen.findByText('у черзі · 2 задачі перед твоєю · ~30 с')).toBeDefined();
    expect(retries.sent).toEqual([FAILED_DRAFT.id]);
    expect(jobs.sent).toEqual([FAILED_JOB.id, RETRIED_JOB_ID]);
    expect(screen.queryByText('AI не впорався')).toBeNull();
    expect(addressNow()).toBe(`/add?review=${FAILED_DRAFT.id}&job=${RETRIED_JOB_ID}#review`);
  });

  it('a deleted failed draft brings the explainer back and takes the draft and its job out of the address', async () => {
    window.history.replaceState(null, '', FAILED_ADDRESS);
    const { user, deletes } = await renderFailedPage();

    await user.click(await screen.findByRole('button', { name: 'Видалити картку' }));
    const asked = within(await screen.findByRole('dialog', { name: 'Видалити картку?' }));
    await user.click(asked.getByRole('button', { name: 'Видалити' }));

    expect(await screen.findByRole('heading', { level: 3, name: ON_BOARD })).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByText('AI не впорався')).toBeNull();
    });
    expect(deletes.sent).toEqual([FAILED_DRAFT.id]);
    expect(addressNow()).toBe('/add#review');
  });

  it('review=garbage shows the explainer and asks for no card', async () => {
    const { sentRequests } = await renderPage({ review: 'garbage' });

    expect(screen.getByRole('heading', { level: 3, name: ON_BOARD })).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
    expect(cardReadsOf(sentRequests)).toEqual([]);
  });

  it('has no accessibility violations', async () => {
    await renderPage({ path: 'paste' });

    expect(await axeViolations()).toEqual([]);
  });
});
