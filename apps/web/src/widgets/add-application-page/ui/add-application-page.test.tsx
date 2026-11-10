import { buildJobStatus } from '@jobflow/shared/testing';
import { screen, waitFor, within } from '@testing-library/react';
import type { RequestHandler } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AddQuery } from '@/features/add-application';
import { addRoutes, FIRST_PASTE } from '@/test/add-fixtures';
import { apiUrl, recordSentRequests } from '@/test/api-handlers';
import { applicationRoute, confirmRoute, REVIEW_DRAFT } from '@/test/application-fixtures';
import { axeViolations } from '@/test/axe';
import { captureTokenRoutes } from '@/test/capture-token-fixtures';
import { jobRoute } from '@/test/job-fixtures';
import { push } from '@/test/navigation';
import { renderInApp } from '@/test/render-in-app';
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

async function renderPage(query: AddQuery = {}, handlers: readonly RequestHandler[] = []) {
  const added = addRoutes();
  server.use(meRoute(), ...captureTokenRoutes().handlers, ...added.handlers, ...handlers);
  const sentRequests = recordSentRequests();
  const user = renderInApp(<AddApplicationPage query={query} />);
  await screen.findByRole('button', { name: 'Створити кнопку' });
  return { user, sentRequests, sent: added.sent };
}

function cardReadsOf(sentRequests: ReturnType<typeof recordSentRequests>) {
  return sentRequests().filter(
    ({ url }) => typeof url === 'string' && url.startsWith(apiUrl('/applications/')),
  );
}

function textField() {
  return screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Текст вакансії' });
}

function linkField() {
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Посилання на вакансію' });
}

describe('AddApplicationPage', () => {
  afterEach(() => {
    push.mockClear();
    vi.restoreAllMocks();
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

  it('a pasted vacancy brings the live panel into view, then its review, and the confirmation leads to the board', async () => {
    const parse = { job: buildJobStatus({ status: 'processing', step: 2, queue: null }) };
    const jobs = jobRoute({ job: () => parse.job });
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
    parse.job = buildJobStatus({ status: 'done', step: 3, queue: null });
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

  it('review=garbage shows the explainer and asks for no card', async () => {
    const { sentRequests } = await renderPage({ review: 'garbage' });

    expect(screen.getByRole('heading', { level: 3, name: 'Картка вже на дошці' })).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
    expect(cardReadsOf(sentRequests)).toEqual([]);
  });

  it('has no accessibility violations', async () => {
    await renderPage({ path: 'paste' });

    expect(await axeViolations()).toEqual([]);
  });
});
