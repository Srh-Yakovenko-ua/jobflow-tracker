import type { ApplicationFilters, ApplicationListItem } from '@jobflow/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { RequestHandler } from 'msw';
import { http } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FULL_CARD } from '@/entities/application';
import { userKeys } from '@/entities/user';
import { applicationFiltersOf } from '@/features/filter-applications';
import { withSearchParams } from '@/shared/api';
import { apiUrl, errorReply } from '@/test/api-handlers';
import { layOutColumns } from '@/test/board-drag';
import { fixtureIdOf, moveRoute } from '@/test/board-fixtures';
import { fakeTimeouts } from '@/test/fake-timeouts';
import { stubFileDownload } from '@/test/file-download';
import { latch } from '@/test/latch';
import { listItemsIn, pagedListRoute, type PagedListRouteOptions } from '@/test/list-fixtures';
import { push } from '@/test/navigation';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import { ApplicationsTable } from './applications-table';

vi.mock('next/link', () => import('@/test/link'));
vi.mock('next/navigation', () => import('@/test/navigation'));

type ItemSeed = Partial<ApplicationListItem> & { serial: number };

type TableSetup = PagedListRouteOptions & { filters?: ApplicationFilters };

function itemOf({ serial, ...fields }: ItemSeed): ApplicationListItem {
  return { ...FULL_CARD, snippet: null, id: fixtureIdOf(serial), salaryMin: null, ...fields };
}

const SCORED: readonly ApplicationListItem[] = [
  itemOf({ serial: 1, company: 'Альфа', currentStage: 'applied', matchScore: 91, salaryMax: 5000 }),
  itemOf({
    serial: 2,
    company: 'Бета',
    currentStage: 'screening',
    matchScore: null,
    salaryMax: null,
    currency: null,
  }),
  itemOf({
    serial: 3,
    company: 'Гамма',
    currentStage: 'tech_interview',
    matchScore: 40,
    salaryMax: 2000,
  }),
  itemOf({ serial: 4, company: 'Дельта', currentStage: 'final', matchScore: 62, salaryMax: 3000 }),
  itemOf({ serial: 5, company: 'Епсилон', currentStage: 'offer', matchScore: 40, salaryMax: 7000 }),
];

const COLUMN_NAMES = [
  'Компанія',
  'Етап',
  'Match Score',
  'Вилка',
  'Джерело',
  'Дата відгуку',
  'Остання подія',
  'Днів на етапі',
] as const;

const TOOLBAR_CONTROLS = [
  { name: 'Джерело: усі', desktop: 'h-8.5' },
  { name: 'Фільтри', desktop: 'h-8.5' },
  { name: 'Колонки', desktop: 'h-control-sm' },
  { name: 'Завантажити CSV з поточним поданням', desktop: 'h-control-sm' },
] as const;

const TOUCH_BOX = 'max-md:min-h-11';

const RETRY_WAIT = { timeout: 2500 } as const;

type TableRender = { handlers: readonly RequestHandler[]; filters?: ApplicationFilters };

function renderTableOver({ handlers, filters = {} }: TableRender) {
  server.use(meRoute(), ...handlers);
  layOutColumns();
  window.history.replaceState(null, '', withSearchParams(window.location.pathname, filters));
  return renderInApp(
    <>
      <ApplicationsTable initial={{ filters }} />
      <QueryProbe queryKey={userKeys.me()} />
    </>,
  );
}

function renderTable({ items, filters = {}, ...control }: TableSetup) {
  const list = pagedListRoute({ items, ...control });
  const moves = moveRoute();
  const user = renderTableOver({ handlers: [list.handler, moves.handler], filters });
  return { user, sent: list.sent, moves: moves.sent };
}

async function tableReady(setup: TableSetup) {
  const rendered = renderTable(setup);
  await screen.findByRole('table', { name: 'Вакансії в таблиці' });
  await waitForQuery({ queryKey: userKeys.me(), status: 'success' });
  return rendered;
}

function companiesShown(): (string | null)[] {
  return screen.getAllByRole('link').map((link) => link.textContent);
}

function tableScroller(): HTMLElement {
  const scroller = document.querySelector<HTMLElement>('[data-table-scroll]');
  if (scroller === null) {
    throw new Error('the table does not scroll');
  }
  return scroller;
}

function checkboxNamed(name: string): HTMLElement {
  return screen.getByRole('checkbox', { name });
}

async function hideColumns(user: ReturnType<typeof renderInApp>, names: readonly string[]) {
  await user.click(screen.getByRole('button', { name: 'Колонки' }));
  for (const name of names) {
    await user.click(checkboxNamed(name));
  }
  await user.keyboard('{Escape}');
}

function sentQueryOf(query: string | undefined): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(query));
}

function findRetry(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: 'Спробувати ще раз' }, RETRY_WAIT);
}

function classesOf(element: HTMLElement): string[] {
  return element.className.split(' ');
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
  vi.useRealTimers();
  push.mockClear();
});

describe('ApplicationsTable rows', () => {
  it('500 cards over 5 pages mount fewer than 40 rows, the footer counts all 500, the header row stays first in the scroller and its end shows the last card', async () => {
    const { sent } = await tableReady({
      items: listItemsIn({ stage: 'applied', count: 500, from: 1000 }),
    });
    const table = screen.getByRole('table', { name: 'Вакансії в таблиці' });

    expect(sent).toHaveLength(5);
    expect(screen.getByText('усього 500 карток')).toBeDefined();
    expect(within(table).getAllByRole('row').length).toBeLessThan(40);
    tableScroller().scrollTop = 100_000;
    fireEvent.scroll(tableScroller());

    expect(await screen.findByText('Vacancy 1499')).toBeDefined();
    const firstRow = tableScroller().querySelector('tr');
    expect(firstRow === null ? [] : within(firstRow).getAllByRole('columnheader')).toHaveLength(9);
  });

  it('the company links to its card, and a click anywhere else on the row opens the same card while its checkbox only selects', async () => {
    const { user } = await tableReady({ items: SCORED });

    expect(screen.getByRole('link', { name: 'Альфа' }).getAttribute('href')).toBe(
      `/applications/${fixtureIdOf(1)}`,
    );
    await user.click(checkboxNamed('Обрати «Дельта»'));
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getAllByText('Senior Frontend Engineer')[0] ?? document.body);
    expect(push).toHaveBeenCalledExactlyOnceWith(`/applications/${fixtureIdOf(1)}`);
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Альфа' }));
  });

  it('a held list shows the loading status and no table yet', async () => {
    renderTable({ items: SCORED, latch: latch() });

    expect((await screen.findByText('Завантаження…')).getAttribute('role')).toBe('status');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('a failed list offers a retry, and the retry brings the rows in', async () => {
    const failing = http.get(apiUrl('/applications'), () =>
      errorReply({ status: 500, type: 'internal_error' }),
    );
    const user = renderTableOver({ handlers: [failing] });
    const retry = await findRetry();

    server.use(pagedListRoute({ items: SCORED }).handler);
    await user.click(retry);

    expect(await screen.findByRole('link', { name: 'Альфа' })).toBeDefined();
  });

  it('a later page that fails shows the load failed panel instead of a part of the rows, and the retry loads every page', async () => {
    const laterPageFails = http.get(apiUrl('/applications'), ({ request }) =>
      new URL(request.url).searchParams.has('cursor')
        ? errorReply({ status: 500, type: 'internal_error' })
        : undefined,
    );
    const list = pagedListRoute({ items: SCORED, pageSize: 2 });
    const user = renderTableOver({ handlers: [laterPageFails, list.handler] });
    const retry = await findRetry();
    expect(screen.queryByRole('table')).toBeNull();

    server.use(pagedListRoute({ items: SCORED, pageSize: 2 }).handler);
    await user.click(retry);

    expect(await screen.findByRole('link', { name: 'Епсилон' })).toBeDefined();
  });
});

describe('ApplicationsTable sorting and columns', () => {
  it('score sorts down then up with empty scores last both times, and Shift on вилка adds it as the second key', async () => {
    const { user } = await tableReady({ items: SCORED });
    const score = screen.getByRole('button', { name: 'score' });

    await user.click(score);
    expect(companiesShown()).toEqual(['Альфа', 'Дельта', 'Гамма', 'Епсилон', 'Бета']);
    expect(screen.getByRole('columnheader', { name: 'score' }).getAttribute('aria-sort')).toBe(
      'descending',
    );

    await user.click(score);
    expect(companiesShown()).toEqual(['Гамма', 'Епсилон', 'Дельта', 'Альфа', 'Бета']);

    await user.keyboard('{Shift>}');
    await user.click(screen.getByRole('button', { name: 'вилка' }));
    await user.keyboard('{/Shift}');

    expect(companiesShown()).toEqual(['Епсилон', 'Гамма', 'Дельта', 'Альфа', 'Бета']);
    const ranked = screen.getByRole('columnheader', { name: 'вилка, ключ сортування 2' });
    expect(ranked.getAttribute('aria-sort')).toBeNull();
    expect(
      screen
        .getByRole('columnheader', { name: 'score, ключ сортування 1' })
        .getAttribute('aria-sort'),
    ).toBe('ascending');
  });

  it('hiding Джерело drops its header and cells, and the last shown column cannot be hidden', async () => {
    const { user } = await tableReady({ items: SCORED });
    expect(screen.getAllByRole('cell', { name: 'Djinni' })).toHaveLength(5);

    await hideColumns(user, ['Джерело']);

    expect(screen.queryByRole('columnheader', { name: 'джерело' })).toBeNull();
    expect(screen.queryAllByRole('cell', { name: 'Djinni' })).toHaveLength(0);
    await hideColumns(
      user,
      COLUMN_NAMES.slice(1).filter((name) => name !== 'Джерело'),
    );
    await user.click(screen.getByRole('button', { name: 'Колонки' }));

    expect(screen.getByRole('columnheader', { name: 'компанія' })).toBeDefined();
    expect(checkboxNamed('Компанія').hasAttribute('disabled')).toBe(true);
    expect(checkboxNamed('Етап').hasAttribute('disabled')).toBe(false);
  });

  it('below md the toolbar menus, Колонки, CSV and every sort header grow to a 44 px box, above it the toolbar keeps its drawn height', async () => {
    await tableReady({ items: SCORED });
    const sortButtons = screen
      .getAllByRole('columnheader')
      .flatMap((header) => within(header).queryAllByRole('button'));

    for (const { name, desktop } of TOOLBAR_CONTROLS) {
      expect(classesOf(screen.getByRole('button', { name })), name).toEqual(
        expect.arrayContaining([desktop, TOUCH_BOX]),
      );
    }
    expect(sortButtons).toHaveLength(8);
    for (const button of sortButtons) {
      expect(classesOf(button), button.textContent).toContain(TOUCH_BOX);
    }
  });

  it('below md every company link spans a 44 px box that is at least 44 px wide, inside the drawn row height', async () => {
    await tableReady({ items: SCORED });

    for (const link of screen.getAllByRole('link')) {
      const box = link.parentElement;
      expect(box === null ? [] : classesOf(box), link.textContent).toContain(TOUCH_BOX);
      expect(classesOf(link), link.textContent).toEqual(
        expect.arrayContaining(['row-span-full', 'max-md:min-w-11']),
      );
    }
  });

  it('CSV saves a UTF-8 file with a BOM, named by the day, with the shown columns in the shown order', async () => {
    const { user } = await tableReady({ items: SCORED.slice(0, 3) });
    await hideColumns(user, ['Етап', 'Джерело', 'Дата відгуку', 'Остання подія', 'Днів на етапі']);
    await user.click(screen.getByRole('button', { name: 'score' }));
    await user.click(screen.getByRole('button', { name: 'score' }));
    const download = stubFileDownload();

    await user.click(screen.getByRole('button', { name: 'Завантажити CSV з поточним поданням' }));

    const [blob] = download.blobs();
    const bytes = new Uint8Array((await blob?.arrayBuffer()) ?? new ArrayBuffer(0));
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(blob?.type).toBe('text/csv;charset=utf-8');
    expect(download.anchors()[0]?.download).toMatch(
      /^jobflow-applications-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    expect(new TextDecoder().decode(bytes).split('\r\n')).toEqual([
      'Компанія;Посада;Match Score;Зарплата від;Зарплата до;Валюта',
      'Гамма;Senior Frontend Engineer;40;;2000;USD',
      'Альфа;Senior Frontend Engineer;91;;5000;USD',
      'Бета;Senior Frontend Engineer;;;;',
      '',
    ]);
  });
});

describe('ApplicationsTable bulk actions', () => {
  it('one picked row makes the header checkbox mixed, then all are picked and moved one stage on, an offer staying put', async () => {
    const { user, moves } = await tableReady({ items: SCORED });

    await user.click(checkboxNamed('Обрати «Бета»'));
    expect(checkboxNamed('Обрати всі картки').getAttribute('aria-checked')).toBe('mixed');
    expect(screen.getByText('1 картку обрано')).toBeDefined();
    await user.click(checkboxNamed('Обрати всі картки'));
    expect(screen.getByText('5 карток обрано')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Перенести далі' }));

    await waitFor(() => {
      expect(screen.queryByRole('group', { name: 'Дії з обраними картками' })).toBeNull();
    });
    expect(moves).toEqual([
      { fromStage: 'applied', toStage: 'screening' },
      { fromStage: 'screening', toStage: 'tech_interview' },
      { fromStage: 'tech_interview', toStage: 'final' },
      { fromStage: 'final', toStage: 'offer' },
    ]);
    expect(document.activeElement).toBe(checkboxNamed('Обрати всі картки'));
  });

  it('Відкликати asks first and sends nothing until the confirm, then withdraws each picked card', async () => {
    const { user, moves } = await tableReady({ items: SCORED });
    await user.click(checkboxNamed('Обрати «Альфа»'));
    await user.click(checkboxNamed('Обрати «Бета»'));

    await user.click(screen.getByRole('button', { name: 'Відкликати' }));
    const dialog = await screen.findByRole('dialog', { name: 'Відкликати 2 картки?' });
    expect(moves).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Відкликати' }));

    await waitFor(() => {
      expect(moves).toEqual([
        { fromStage: 'applied', toStage: 'withdrawn' },
        { fromStage: 'screening', toStage: 'withdrawn' },
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('Перенести далі moves the picked cards in the order the table is sorted, not the order the server sent', async () => {
    const { user, moves } = await tableReady({ items: SCORED });
    await user.click(screen.getByRole('button', { name: 'score' }));
    await user.click(checkboxNamed('Обрати всі картки'));

    await user.click(screen.getByRole('button', { name: 'Перенести далі' }));

    await waitFor(() => {
      expect(moves).toHaveLength(4);
    });
    expect(moves).toEqual([
      { fromStage: 'applied', toStage: 'screening' },
      { fromStage: 'final', toStage: 'offer' },
      { fromStage: 'tech_interview', toStage: 'final' },
      { fromStage: 'screening', toStage: 'tech_interview' },
    ]);
  });

  it('picks a query hid are dropped: clearing it shows every row unpicked, the header box unchecked and no bulk bar', async () => {
    fakeTimeouts();
    const { user } = await tableReady({
      items: (params) => (params.has('q') ? SCORED.slice(0, 1) : SCORED),
    });
    await user.click(checkboxNamed('Обрати «Альфа»'));
    await user.click(checkboxNamed('Обрати «Бета»'));
    const search = screen.getByRole('textbox', { name: 'Пошук у таблиці' });

    await user.type(search, 'альфа');
    await act(() => vi.advanceTimersByTimeAsync(250));
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Бета' })).toBeNull();
    });
    await user.clear(search);

    expect(await screen.findByRole('link', { name: 'Бета' })).toBeDefined();
    expect(checkboxNamed('Обрати «Альфа»').getAttribute('aria-checked')).toBe('false');
    expect(checkboxNamed('Обрати «Бета»').getAttribute('aria-checked')).toBe('false');
    expect(checkboxNamed('Обрати всі картки').getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByRole('group', { name: 'Дії з обраними картками' })).toBeNull();
  });

  it('Скинути вибір clears the pick and hides the bar', async () => {
    const { user } = await tableReady({ items: SCORED });
    await user.click(checkboxNamed('Обрати «Альфа»'));

    await user.click(screen.getByRole('button', { name: 'Скинути вибір' }));

    expect(screen.queryByRole('group', { name: 'Дії з обраними картками' })).toBeNull();
    expect(checkboxNamed('Обрати «Альфа»').getAttribute('aria-checked')).toBe('false');
  });
});

describe('ApplicationsTable filters', () => {
  it('stage, source and a typed query go to /applications after the pause, a cleared query shows every card at once, and the view switch keeps the filters', async () => {
    fakeTimeouts();
    const route = pagedListRoute({ items: (params) => (params.has('q') ? [] : SCORED) });
    const filters = applicationFiltersOf({ stage: 'screening', source: 'djinni' });
    const user = renderTableOver({ handlers: [route.handler], filters });
    await screen.findByRole('link', { name: 'Альфа' });

    await user.type(screen.getByRole('textbox', { name: 'Пошук у таблиці' }), 'react');
    await act(() => vi.advanceTimersByTimeAsync(250));

    expect(await screen.findByText('Немає карток за «react»')).toBeDefined();
    expect(route.sent.map(sentQueryOf)).toContainEqual({
      stage: 'screening',
      source: 'djinni',
      q: 'react',
      limit: '100',
      sort: '-lastEventAt',
    });
    await user.click(screen.getByRole('button', { name: 'Скинути' }));
    expect(screen.getByRole('link', { name: 'Альфа' })).toBeDefined();

    const views = within(screen.getByRole('radiogroup', { name: 'Подання' }));
    expect(views.getByRole('radio', { name: 'Таблиця' }).getAttribute('aria-checked')).toBe('true');
    await user.click(views.getByRole('radio', { name: 'Дошка' }));
    expect(push).toHaveBeenCalledExactlyOnceWith('/board?stage=screening&source=djinni');
  });

  it('the stage chips count every card per open stage, and a picked chip asks for its stage while the counts stay whole', async () => {
    const route = pagedListRoute({
      items: (params) =>
        SCORED.filter((item) => (params.get('stage') ?? item.currentStage) === item.currentStage),
    });
    const user = renderTableOver({ handlers: [route.handler] });
    await screen.findByRole('link', { name: 'Альфа' });
    const chips = within(screen.getByRole('group', { name: 'Етап' }));

    expect(chips.getAllByRole('button').map((chip) => chip.textContent)).toEqual([
      'відгук1',
      'скринінг1',
      "техінтерв'ю1",
      'фінал1',
    ]);
    await user.click(chips.getByRole('button', { name: /^скринінг/ }));

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Альфа' })).toBeNull();
    });
    expect(route.sent.map(sentQueryOf)).toContainEqual({
      stage: 'screening',
      limit: '100',
      sort: '-lastEventAt',
    });
    expect(chips.getByRole('button', { name: /^скринінг/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(chips.getByRole('button', { name: /^відгук/ }).textContent).toBe('відгук1');
  });

  it('no cards at all shows the first run without the toolbar', async () => {
    renderTable({ items: [] });

    expect(await screen.findByText('Тут буде твоя воронка')).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Пошук у таблиці' })).toBeNull();
  });

  it('no cards under a filter keeps the toolbar and shows the filtered empty state, whose reset asks again without the filter', async () => {
    const { user, sent } = renderTable({ items: [], filters: { source: ['djinni'] } });

    expect(await screen.findByText('Немає карток за цими фільтрами')).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Пошук у таблиці' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Скинути фільтри' }));

    await waitFor(() => {
      expect(sentQueryOf(sent.at(-1))).toEqual({ limit: '100', sort: '-lastEventAt' });
    });
  });
});
