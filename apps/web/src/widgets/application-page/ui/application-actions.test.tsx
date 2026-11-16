import type { Stage } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { calendarQueryOptions } from '@/entities/scheduled-event';
import { searchKeys } from '@/entities/search';
import { ACTIVE_SEARCH, ARCHIVED_SEARCH } from '@/test/analytics-fixtures';
import { apiUrl, errorReply } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { calendarRoute, KYIV_WEEK } from '@/test/calendar-fixtures';
import { back, push, replace } from '@/test/navigation';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import {
  type ApplicationPageSetup,
  findApplicationTitle,
  renderApplicationPage,
} from '@/test/render-application-page';
import { OFFER_APPLICATION } from '@/test/search-fixtures';
import { server } from '@/test/server';
import { GHOSTED_FROM_SCREENING_TIMELINE } from '@/test/timeline-fixtures';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

afterEach(() => {
  back.mockClear();
  push.mockClear();
  replace.mockClear();
});

const SETTLED_STAGES: readonly Stage[] = ['offer', 'rejected', 'ghosted', 'withdrawn'];

const GHOSTED_FROM_SCREENING: ApplicationPageSetup = {
  application: { ...ACME_APPLICATION, currentStage: 'ghosted' },
  timeline: GHOSTED_FROM_SCREENING_TIMELINE,
};

const REVIVE = 'Компанія відповіла: повернути в скринінг';

const ACCEPTED = { name: 'Офер прийнято' } as const;

const ARCHIVE = { name: 'Заархівувати пошук' } as const;

const CONFLICT = 'Цей пошук уже завершено';

function CalendarWatch() {
  useQuery(calendarQueryOptions(KYIV_WEEK));
  return null;
}

async function openFinishDialog(setup: ApplicationPageSetup = {}) {
  const rendered = renderApplicationPage({ application: OFFER_APPLICATION, ...setup });
  await rendered.user.click(await screen.findByRole('button', ACCEPTED));
  const dialog = await screen.findByRole('dialog', ACCEPTED);
  return { ...rendered, dialog };
}

const SCHEDULE_OFFERED: readonly { stage: Stage; offered: boolean }[] = [
  { stage: 'applied', offered: true },
  { stage: 'tech_interview', offered: true },
  { stage: 'offer', offered: true },
  { stage: 'ghosted', offered: true },
  { stage: 'rejected', offered: false },
  { stage: 'withdrawn', offered: false },
];

describe('ApplicationActions', () => {
  it('the primary moves the application to the next stage once and the chip follows', async () => {
    const { user, moves } = renderApplicationPage();

    await user.click(await screen.findByRole('button', { name: 'Перенести у «фінал»' }));

    expect(await screen.findByText('фінал')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Перенести у «офер»' })).toBeDefined();
    expect(moves).toEqual([{ fromStage: 'tech_interview', toStage: 'final' }]);
  });

  it('Відмова asks the reason, records it, and the undo returns focus to the title', async () => {
    const { user, moves, undone } = renderApplicationPage();

    await user.click(await screen.findByRole('button', { name: 'Відмова' }));
    await screen.findByRole('dialog', { name: 'Що сталося?' });
    await user.click(screen.getByRole('button', { name: 'не вистачає скілів' }));
    expect(await screen.findByText('записано в аналітику')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Скасувати перенос' }));

    const heading = await findApplicationTitle();
    await waitFor(() => {
      expect(document.activeElement).toBe(heading);
    });
    expect(moves).toEqual([
      { fromStage: 'tech_interview', toStage: 'rejected', reasonCode: 'skills_gap' },
    ]);
    expect(undone).toEqual([{ id: ACME_APPLICATION.id, body: '' }]);
  });

  it.each(SETTLED_STAGES)(
    'an application in %s offers neither a next stage nor Відмова',
    async (stage) => {
      renderApplicationPage({ application: { ...ACME_APPLICATION, currentStage: stage } });

      await findApplicationTitle();
      expect(screen.queryByRole('button', { name: /^Перенести у/ })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Відмова' })).toBeNull();
    },
  );

  it('a ghosted application whose company replied returns to the stage before the ghost move', async () => {
    const { user, moves } = renderApplicationPage(GHOSTED_FROM_SCREENING);

    await user.click(await screen.findByRole('button', { name: REVIVE }));

    await waitFor(() => {
      expect(moves).toEqual([{ fromStage: 'ghosted', toStage: 'screening' }]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: REVIVE })).toBeNull();
    });
  });

  it('a refused revive rolls back, says why and keeps the button', async () => {
    const { user, moves } = renderApplicationPage(GHOSTED_FROM_SCREENING);
    server.use(
      http.post(apiUrl('/applications/:id/events'), () =>
        errorReply({ status: 409, type: 'illegal_transition' }),
      ),
    );

    await user.click(await screen.findByRole('button', { name: REVIVE }));

    expect(await screen.findByText('Такий перехід неможливий')).toBeDefined();
    expect(screen.getByRole('button', { name: REVIVE })).toBeDefined();
    expect(moves).toEqual([]);
  });

  it.each(['applied', 'rejected'] as const)(
    'an application in %s offers no revive',
    async (stage) => {
      renderApplicationPage({
        ...GHOSTED_FROM_SCREENING,
        application: { ...ACME_APPLICATION, currentStage: stage },
      });

      await findApplicationTitle();
      expect(screen.queryByRole('button', { name: /Компанія відповіла/ })).toBeNull();
    },
  );

  it.each(SCHEDULE_OFFERED)(
    'an application in $stage offers Запланувати: $offered',
    async ({ stage, offered }) => {
      renderApplicationPage({ application: { ...ACME_APPLICATION, currentStage: stage } });

      await findApplicationTitle();
      expect(screen.queryByRole('button', { name: 'Запланувати' }) !== null).toBe(offered);
    },
  );

  it('Запланувати opens the dialog, and Скасувати sends nothing and returns focus to the title', async () => {
    const { user, scheduledEvents } = renderApplicationPage();

    await user.click(await screen.findByRole('button', { name: 'Запланувати' }));
    const dialog = await screen.findByRole('dialog', { name: 'Запланувати подію' });
    await user.click(within(dialog).getByRole('button', { name: 'Скасувати' }));

    const heading = await findApplicationTitle();
    await waitFor(() => {
      expect(document.activeElement).toBe(heading);
    });
    expect(scheduledEvents.created).toEqual([]);
  });

  it('opens the vacancy link in a new tab without handing it the page', async () => {
    renderApplicationPage();

    const link = await screen.findByRole('link', { name: 'Відкрити вакансію' });
    expect(link.getAttribute('href')).toBe('https://jobs.example.com/acme/senior-react');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it.each([null, 'javascript:alert(1)', 'ftp://jobs.example.com/1'])(
    'has no vacancy link when the url is %s',
    async (url) => {
      renderApplicationPage({ application: { ...ACME_APPLICATION, url } });

      await findApplicationTitle();
      expect(screen.queryByRole('link', { name: 'Відкрити вакансію' })).toBeNull();
    },
  );

  it.each([
    { mode: 'page', left: replace, to: ['/board'] },
    { mode: 'sheet', left: back, to: [] },
  ] as const)(
    'Видалити in the $mode asks first, deletes once, closes what is open and leaves for the board',
    async ({ mode, left, to }) => {
      const { user, deletes } = renderApplicationPage({ mode });

      await user.click(await screen.findByRole('button', { name: 'Ще дії' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Видалити' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Видалити картку?' });
      await user.click(within(dialog).getByRole('button', { name: 'Видалити' }));

      await waitFor(() => {
        expect(left).toHaveBeenCalledWith(...to);
      });
      await waitFor(() => {
        expect([screen.queryByRole('alertdialog'), screen.queryByRole('dialog')]).toEqual([
          null,
          null,
        ]);
      });
      expect(left).toHaveBeenCalledTimes(1);
      expect(deletes).toEqual([ACME_APPLICATION.id]);
    },
  );

  it('Скасувати in the delete dialog sends nothing and returns focus to Ще дії', async () => {
    const { user, deletes } = renderApplicationPage();

    const more = await screen.findByRole('button', { name: 'Ще дії' });
    await user.click(more);
    await user.click(await screen.findByRole('menuitem', { name: 'Видалити' }));
    await user.click(await screen.findByRole('button', { name: 'Скасувати' }));

    await waitFor(() => {
      expect(document.activeElement).toBe(more);
    });
    expect(screen.queryByRole('alertdialog', { name: 'Видалити картку?' })).toBeNull();
    expect(deletes).toEqual([]);
  });

  it('Escape on the delete confirm opened from the keyboard returns focus to Ще дії', async () => {
    const { user, deletes } = renderApplicationPage();

    const more = await screen.findByRole('button', { name: 'Ще дії' });
    more.focus();
    await user.keyboard('{Enter}');
    (await screen.findByRole('menuitem', { name: 'Видалити' })).focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('alertdialog', { name: 'Видалити картку?' });
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(document.activeElement).toBe(more);
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(deletes).toEqual([]);
  });

  it('Офер прийнято in the board sheet archives the search once, refetches the board and the calendar and lands on the board', async () => {
    const calendar = calendarRoute();
    server.use(calendar.handler);
    const { user, dialog, finish, board } = await openFinishDialog({
      mode: 'sheet',
      board: { counts: { offer: 1 } },
      alongside: <CalendarWatch />,
    });
    expect(within(dialog).getByText('Пошук завершено')).toBeDefined();
    const [boardReads, calendarReads] = [board.length, calendar.sent.length];

    await user.click(within(dialog).getByRole('button', ARCHIVE));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/board');
    });
    expect(finish.sent).toEqual([
      { searchId: ACTIVE_SEARCH.id, outcome: 'offer_accepted', openApplications: 'withdraw' },
    ]);
    expect(board.length).toBeGreaterThan(boardReads);
    expect(calendar.sent.length).toBeGreaterThan(calendarReads);
  });

  it('Скасувати in the finish dialog sends nothing and leaves the page', async () => {
    const { user, dialog, finish } = await openFinishDialog();

    await user.click(within(dialog).getByRole('button', { name: 'Скасувати' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', ACCEPTED)).toBeNull();
    });
    expect(finish.sent).toEqual([]);
    expect(push).not.toHaveBeenCalled();
  });

  it.each(['No active search', 'The search is already finished'])(
    'a 409 "%s" on the finish says once that the search is already finished',
    async (detail) => {
      const { user, dialog } = await openFinishDialog({
        searches: { reply: () => errorReply({ status: 409, type: 'conflict', detail }) },
      });

      await user.click(within(dialog).getByRole('button', ARCHIVE));

      expect(await screen.findByText(CONFLICT)).toBeDefined();
      expect(screen.getAllByText(CONFLICT)).toHaveLength(1);
      expect(screen.queryByText('Не вдалося зберегти')).toBeNull();
      expect(push).not.toHaveBeenCalled();
    },
  );

  it('a card short of the offer stage offers no search finish', async () => {
    const { finish } = renderApplicationPage();

    await findApplicationTitle();
    expect(screen.queryByRole('button', ACCEPTED)).toBeNull();
    expect(finish.listed).toEqual([]);
  });

  it('an offer from an archived search offers no search finish', async () => {
    renderApplicationPage({
      application: { ...OFFER_APPLICATION, searchId: ARCHIVED_SEARCH.id },
      alongside: <QueryProbe queryKey={searchKeys.list()} />,
    });

    await waitForQuery({ queryKey: searchKeys.list(), status: 'success' });
    await findApplicationTitle();
    expect(screen.queryByRole('button', ACCEPTED)).toBeNull();
  });

  it('Enter on Ще дії opens the menu with Редагувати and Видалити', async () => {
    const { user } = renderApplicationPage();

    (await screen.findByRole('button', { name: 'Ще дії' })).focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('menuitem', { name: 'Редагувати' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Видалити' })).toBeDefined();
  });
});
