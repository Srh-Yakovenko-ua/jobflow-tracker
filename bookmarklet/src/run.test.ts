import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { run } from './run.js';
import {
  ADDED_BODY,
  CONFIG,
  conflictReply,
  DUPLICATE,
  type FetchReply,
  stubFetch,
} from './test/api.js';
import { LINKEDIN_PAGE } from './test/fixtures/pages.js';
import { mountPage, shownToast, toastHosts, toastLinkHref } from './test/page.js';
import { toastIsBusy } from './toast.js';

const NOW = new Date('2026-11-10T12:00:00.000Z');
const SUCCESS = 'Додано в JobFlow · AI розбирає';
const PAGE_URL = 'http://localhost:3000/jobs/view/4321';
const PAGE_TEXT = 'Frontend Engineer\nGlobex\nBuild the design system.\nReact, TypeScript.';

function openReturning(opened: Window | null) {
  return vi.spyOn(window, 'open').mockReturnValue(opened);
}

function openedUrlOf(open: MockInstance<typeof window.open>): string {
  return String(open.mock.calls[0]?.[0]);
}

function sentBodyOf(fetchStub: ReturnType<typeof stubFetch>): unknown {
  const body = fetchStub.mock.calls[0]?.[1].body;
  return typeof body === 'string' ? JSON.parse(body) : undefined;
}

function expectAddUrl(href: string | undefined): void {
  const addUrl = new URL(href ?? '');
  expect(addUrl.origin + addUrl.pathname).toBe('http://localhost:3000/add');
  expect(addUrl.searchParams.get('url')).toBe(PAGE_URL);
  expect(addUrl.searchParams.get('text')).toBe(`Frontend Engineer at Globex\n\n${PAGE_TEXT}`);
  expect(href).not.toContain(CONFIG.token);
}

describe('run', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    mountPage(LINKEDIN_PAGE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends the page and shows the added toast with a link to the card, then hides it', async () => {
    const fetchStub = stubFetch({ status: 202, body: ADDED_BODY });

    await run(CONFIG);

    expect(sentBodyOf(fetchStub)).toEqual({
      url: PAGE_URL,
      title: 'Frontend Engineer at Globex',
      text: PAGE_TEXT,
    });
    expect(shownToast().textContent).toBe(`${SUCCESS}Відкрити картку`);
    expect(toastLinkHref()).toBe(
      'http://localhost:3000/applications/6f1c2b1e-5a0d-4c5e-9b7a-2f4d8e1a3c10',
    );

    vi.advanceTimersByTime(8000);
    expect(toastHosts()).toHaveLength(0);
  });

  it('adds the duplicate line and keeps the toast until it is closed', async () => {
    stubFetch({ status: 202, body: { ...ADDED_BODY, possibleDuplicates: [DUPLICATE] } });

    await run(CONFIG);
    vi.advanceTimersByTime(60_000);

    expect(shownToast().textContent).toBe(
      `${SUCCESS}Ти вже відгукувався сюди 23 дні тому, етап: відмоваВідкрити картку`,
    );
  });

  it('ends in the failed toast when the duplicate date is unreadable, and takes the next click', async () => {
    const unreadable = { ...DUPLICATE, appliedAt: 'yesterday' };
    const fetchStub = stubFetch({
      status: 202,
      body: { ...ADDED_BODY, possibleDuplicates: [unreadable] },
    });

    await run(CONFIG);

    expect(shownToast().textContent).toBe('Не вдалося додатиДодати вручну');
    expect(toastIsBusy()).toBe(false);
    expectAddUrl(toastLinkHref());

    await run(CONFIG);

    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('shows the sending toast and ignores a second click while the first is in flight', async () => {
    const fetchStub = stubFetch('silent');

    void run(CONFIG);
    await run(CONFIG);

    expect(shownToast().textContent).toBe('Додаємо в JobFlow…');
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it('opens the add page when the page may not reach the API', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    const open = openReturning(window);

    await run(CONFIG);

    expectAddUrl(openedUrlOf(open));
    expect(toastHosts()).toHaveLength(0);
  });

  it('gives a silent API 20 seconds, then opens the add page', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort());
    stubFetch('silent');
    const open = openReturning(window);

    await run(CONFIG);

    expect(timeout).toHaveBeenCalledWith(20_000);
    expectAddUrl(openedUrlOf(open));
  });

  it('shows the add link in a toast when the browser blocks the new tab', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    const open = openReturning(null);

    await run(CONFIG);

    expect(shownToast().textContent).toBe('Не вдалося додатиДодати вручну');
    expect(toastLinkHref()).toBe(openedUrlOf(open));
    expectAddUrl(toastLinkHref());
  });

  it.each<{ name: string; reply: FetchReply; text: string; href?: string }>([
    {
      name: 'a revoked token',
      reply: { status: 401 },
      text: 'Букмарклет вимкненоСтворити новий',
      href: 'http://localhost:3000/settings',
    },
    {
      name: 'no active search',
      reply: conflictReply('conflict'),
      text: 'Немає активного пошукуВідкрити дошку',
      href: 'http://localhost:3000/board',
    },
    {
      name: 'a page already added today',
      reply: conflictReply('idempotency_conflict'),
      text: 'Вже додано сьогодніВідкрити дошку',
      href: 'http://localhost:3000/board',
    },
    {
      name: 'a rate limit',
      reply: { status: 429, headers: { 'Retry-After': '90' } },
      text: 'Забагато запитів, спробуй через 2 хвилини',
    },
    {
      name: 'a rate limit with an endless wait',
      reply: { status: 429, headers: { 'Retry-After': 'Infinity' } },
      text: 'Забагато запитів, спробуй через 1 хвилину',
    },
  ])('answers $name with its own toast that stays', async ({ reply, text, href }) => {
    stubFetch(reply);
    const open = openReturning(window);

    await run(CONFIG);
    vi.advanceTimersByTime(60_000);

    expect(shownToast().textContent).toBe(text);
    expect(shownToast().textContent).not.toContain('Додано');
    expect(toastLinkHref()).toBe(href);
    expect(open).not.toHaveBeenCalled();
  });

  it('answers any other error with a link to add the vacancy by hand', async () => {
    stubFetch({ status: 500 });
    const open = openReturning(window);

    await run(CONFIG);
    vi.advanceTimersByTime(60_000);

    expect(shownToast().textContent).toBe('Не вдалося додатиДодати вручну');
    expectAddUrl(toastLinkHref());
    expect(open).not.toHaveBeenCalled();
  });
});
