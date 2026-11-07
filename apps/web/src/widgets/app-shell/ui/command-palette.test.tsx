import {
  type ApplicationListItem,
  type BoardCard,
  moveApplicationInputSchema,
} from '@jobflow/shared';
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applicationKeys } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { ACME_APPLICATION, applicationRoute } from '@/test/application-fixtures';
import { axeViolations } from '@/test/axe';
import {
  applicationResponseOf,
  DESIGN_BOARD,
  fixtureIdOf,
  moveRoute,
  reasonsSummaryRoute,
} from '@/test/board-fixtures';
import { flagSwitch } from '@/test/feature-flags';
import { latch } from '@/test/latch';
import { listItemsIn, pagedListRoute } from '@/test/list-fixtures';
import { push, route } from '@/test/navigation';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import { refuseStorage } from '@/test/refusing-storage';
import { renderApplicationPage } from '@/test/render-application-page';
import {
  choose,
  openPalette,
  renderBoardInShell,
  renderSignedIn,
  type ShellSetup,
} from '@/test/render-in-shell';
import { server } from '@/test/server';
import { ME_RESPONSE } from '@/test/session-fixtures';

import { type RecentApplication, rememberRecentApplication } from '../model/recent-applications';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));
vi.mock(import('@/shared/config'), async (importOriginal) => {
  const actual = await importOriginal();
  const { switchableFlags } = await import('@/test/feature-flags');
  return { ...actual, FEATURE_FLAGS: switchableFlags(actual.FEATURE_FLAGS) };
});

type Found = Readonly<Record<string, readonly ApplicationListItem[]>>;

const CARD_ID = fixtureIdOf(101);

const CARD_PAGE = `/applications/${CARD_ID}`;

const CARD = applicationResponseOf({
  id: CARD_ID,
  company: 'Trident Systems',
  position: 'Senior Frontend Engineer',
  currentStage: 'applied',
});

const ROKU = { id: fixtureIdOf(301), company: 'Roku', position: 'Mobile Engineer' };

const ZETA = { id: fixtureIdOf(304), company: 'Zeta', position: 'QA Lead' };

function foundAs(application: RecentApplication): ApplicationListItem[] {
  return listItemsIn({ stage: 'screening', count: 1, from: 301 }).map((item) => ({
    ...item,
    ...application,
  }));
}

const ROKU_FOUND = foundAs(ROKU);

const SEARCH_WAIT = { timeout: 3000 };

function rememberRecent(application: RecentApplication) {
  rememberRecentApplication({ userId: ME_RESPONSE.user.id, application });
}

function paletteRoutes(found: Found = {}) {
  const moves = moveRoute();
  const search = pagedListRoute({ items: (params) => found[params.get('q') ?? ''] ?? [] });
  const card = applicationRoute({ application: CARD, moves: moves.sent });
  server.use(moves.handler, search.handler, card.handler, reasonsSummaryRoute().handler);
  const asked = () => search.sent.map((query) => new URLSearchParams(query).get('q'));
  return { moves: moves.sent, asked };
}

function liveCardAfter(moves: readonly unknown[]) {
  return (card: BoardCard): BoardCard => {
    const last = moves.at(-1);
    if (card.id !== CARD_ID || last === undefined) return card;
    return { ...card, currentStage: moveApplicationInputSchema.parse(last).toStage };
  };
}

function cardLink(): HTMLElement {
  const link = document.querySelector<HTMLElement>(`a[href="${CARD_PAGE}"]`);
  if (link === null) throw new Error(`no link to ${CARD_PAGE}`);
  return link;
}

async function renderWithFocusedCard(shell: ShellSetup = {}) {
  const user = await renderSignedIn(<a href={CARD_PAGE}>{CARD.position}</a>, shell);
  const card = cardLink();
  act(() => {
    card.focus();
  });
  return { user, card };
}

async function findRoku(found: Found) {
  paletteRoutes(found);
  const { user } = await renderWithFocusedCard();
  await openPalette(user);
  await user.keyboard('Roku');
  await within(await screen.findByRole('group', { name: 'Вакансії' }, SEARCH_WAIT)).findByRole(
    'option',
  );
  return user;
}

function optionNames(): (string | null)[] {
  return screen.getAllByRole('option').map((option) => option.textContent);
}

function groupNamed(name: string): HTMLElement {
  return screen.getByRole('group', { name });
}

function dialogClosed() {
  return waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  flagSwitch.everyFlagOn = false;
  route.pathname = '/board';
  push.mockClear();
  localStorage.clear();
});

describe('CommandPalette', () => {
  it('Ctrl+K opens it on its search field, Escape closes it with focus back on the card, and Cmd+K opens it again', async () => {
    paletteRoutes();
    const { user, card } = await renderWithFocusedCard();

    await openPalette(user);
    expect(document.activeElement).toBe(
      screen.getByRole('combobox', { name: 'Вакансії, сторінки й дії' }),
    );
    await user.keyboard('{Escape}');
    await dialogClosed();
    await waitFor(() => {
      expect(document.activeElement).toBe(card);
    });
    await user.keyboard('{Meta>}k{/Meta}');

    expect(await screen.findByRole('dialog', { name: 'Палітра команд' })).toBeDefined();
  });

  it('Ctrl+K over an open application sheet, then Escape, closes only the palette with focus back inside the sheet', async () => {
    route.pathname = `/applications/${ACME_APPLICATION.id}`;
    const { user } = renderApplicationPage({ mode: 'sheet', board: DESIGN_BOARD, inShell: true });
    const sheet = await screen.findByRole('dialog', { name: ACME_APPLICATION.position });
    const focused = document.activeElement;
    expect(sheet.contains(focused)).toBe(true);

    await openPalette(user);
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Палітра команд' })).toBeNull();
    });
    expect(screen.getByRole('dialog', { name: ACME_APPLICATION.position })).toBe(sheet);
    await waitFor(() => {
      expect(document.activeElement).toBe(focused);
    });
  });

  it.each([
    { typed: 'кален', href: '/calendar' },
    { typed: 'rfktyl', href: '/calendar' },
    { typed: 'табл', href: '/applications' },
    { typed: 'дошк', href: '/board' },
    { typed: 'налашт', href: '/settings' },
  ])('«$typed» and Enter go to $href', async ({ typed, href }) => {
    paletteRoutes();
    const { user } = await renderWithFocusedCard();

    await openPalette(user);
    await user.keyboard(`${typed}{Enter}`);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(href);
    });
  });

  it('with the shipped flags it offers the four pages, then the move, the theme and the cheat sheet for the focused card', async () => {
    paletteRoutes();
    const { user } = await renderWithFocusedCard();

    await openPalette(user);
    await screen.findByRole('option', { name: 'Перемістити в…' });

    expect(optionNames()).toEqual([
      'Дошка',
      'Календар',
      'Налаштування',
      'Таблиця',
      'Перемістити в…',
      'Перемкнути тему',
      'Гарячі клавіші',
    ]);
  });

  it.each([
    { label: 'Додати вакансію', href: '/add' },
    { label: 'Вставити текст вакансії', href: '/add?path=paste' },
    { label: 'Відкрити аналітику', href: '/analytics' },
    { label: 'Згенерувати фоллоу-ап', href: `${CARD_PAGE}#follow-up` },
  ])('with every page shipped «$label» goes to $href', async ({ label, href }) => {
    flagSwitch.everyFlagOn = true;
    paletteRoutes();
    const { user } = await renderWithFocusedCard();

    await choose(user, label);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(href);
    });
  });

  it('«Перемкнути тему» turns the light theme dark, and again back to light', async () => {
    paletteRoutes();
    const { user } = await renderWithFocusedCard();

    await choose(user, 'Перемкнути тему');
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
    });
    await choose(user, 'Перемкнути тему');

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('light');
    });
  });

  it('«Щільний режим» on the board picks «Щільні», then «Повний режим» brings «Повні» back', async () => {
    paletteRoutes();
    const user = renderBoardInShell();
    await screen.findByText(CARD.position);

    await choose(user, 'Щільний режим');
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Щільні' }).getAttribute('aria-checked')).toBe(
        'true',
      );
    });
    await choose(user, 'Повний режим');

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Повні' }).getAttribute('aria-checked')).toBe(
        'true',
      );
    });
  });

  it('«Щільний режим» is offered on the board but not while an application is open over it', async () => {
    paletteRoutes();
    const user = renderBoardInShell();
    await screen.findByText(CARD.position);
    await openPalette(user);
    await screen.findByRole('option', { name: 'Щільний режим' });
    await user.keyboard('{Escape}');
    await dialogClosed();
    route.pathname = CARD_PAGE;

    await openPalette(user);
    await screen.findByRole('option', { name: 'Перемкнути тему' });

    expect(screen.queryByRole('option', { name: 'Щільний режим' })).toBeNull();
  });

  it('«Перемістити в…» lists the legal stages of the focused card, and «скринінг» moves it there with focus back on the card', async () => {
    const { moves } = paletteRoutes();
    const user = renderBoardInShell({ ...DESIGN_BOARD, liveCard: liveCardAfter(moves) });
    await screen.findByText(CARD.position);
    act(() => {
      cardLink().focus();
    });

    await choose(user, 'Перемістити в…');
    await screen.findByPlaceholderText('Куди перемістити Trident Systems?');
    expect(optionNames()).toEqual(['скринінг', "техінтерв'ю", 'відмова', 'ghosted', 'відкликав']);
    await user.keyboard('скр{Enter}');

    await waitFor(() => {
      expect(moves).toEqual([{ fromStage: 'applied', toStage: 'screening' }]);
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(cardLink());
    });
  });

  it('on the move list Escape, and Backspace in the empty field, go back to the actions; Escape there closes the palette', async () => {
    paletteRoutes();
    const { user } = await renderWithFocusedCard();

    await choose(user, 'Перемістити в…');
    await screen.findByPlaceholderText('Куди перемістити Trident Systems?');
    await user.keyboard('{Escape}');
    await screen.findByPlaceholderText('Вакансія, сторінка або дія');
    await user.keyboard('Перемістити в…{Enter}');
    await screen.findByPlaceholderText('Куди перемістити Trident Systems?');
    await user.keyboard('{Backspace}');
    await screen.findByPlaceholderText('Вакансія, сторінка або дія');
    await user.keyboard('{Escape}');

    await dialogClosed();
  });

  it('«відмова» from the move list asks for the reason, and Escape there puts focus back on the card with nothing sent', async () => {
    const { moves } = paletteRoutes();
    const { user, card } = await renderWithFocusedCard();

    await choose(user, 'Перемістити в…');
    await screen.findByPlaceholderText('Куди перемістити Trident Systems?');
    await user.keyboard('відм{Enter}');
    await screen.findByRole('dialog', { name: uk.board.reject.title });
    await user.keyboard('{Escape}');

    await dialogClosed();
    await waitFor(() => {
      expect(document.activeElement).toBe(card);
    });
    expect(moves).toEqual([]);
  });

  it('«відмова» with the reason prompt off in settings moves the card at once, asks nothing and puts focus back on the card', async () => {
    const { moves } = paletteRoutes();
    const { user, card } = await renderWithFocusedCard({ settings: { askRejectionReason: false } });

    await choose(user, 'Перемістити в…');
    await screen.findByPlaceholderText('Куди перемістити Trident Systems?');
    await user.keyboard('відм{Enter}');

    await waitFor(() => {
      expect(moves).toEqual([{ fromStage: 'applied', toStage: 'rejected' }]);
    });
    expect(screen.queryByRole('dialog', { name: uk.board.reject.title })).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(card);
    });
  });

  it('an application picked from «Вакансії» opens its page and comes back under «Недавні»', async () => {
    paletteRoutes({ Roku: ROKU_FOUND });
    const { user } = await renderWithFocusedCard();

    await openPalette(user);
    await user.keyboard('Roku');
    await screen.findByRole('group', { name: 'Вакансії' }, SEARCH_WAIT);
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(`/applications/${ROKU.id}`);
    });
    await openPalette(user);

    expect(within(groupNamed('Недавні')).getByRole('option').textContent).toBe(
      'Mobile EngineerRoku',
    );
  });

  it('an application opened on its page shows up under «Недавні»', async () => {
    paletteRoutes();
    route.pathname = CARD_PAGE;
    const user = await renderSignedIn(<QueryProbe queryKey={applicationKeys.detail(CARD_ID)} />);
    await waitForQuery({ queryKey: applicationKeys.detail(CARD_ID), status: 'success' });

    await openPalette(user);

    expect(within(groupNamed('Недавні')).getByRole('option').textContent).toBe(
      'Senior Frontend EngineerTrident Systems',
    );
  });

  it('«кщ» typed on the Ukrainian layout finds Roku under «Недавні»', async () => {
    rememberRecent(ROKU);
    paletteRoutes();
    const { user } = await renderWithFocusedCard();

    await openPalette(user);
    await user.keyboard('кщ');

    expect(within(groupNamed('Недавні')).getByRole('option').textContent).toBe(
      'Mobile EngineerRoku',
    );
  });

  it.each([
    { typed: 'тему', position: 'Frontend Developer' },
    { typed: 'тем', position: 'Тестувальник мобільних' },
  ])(
    '«$typed» and Enter switch the theme, not open a recent «$position» that holds those letters only scattered',
    async ({ typed, position }) => {
      rememberRecent({ id: fixtureIdOf(303), company: 'Acme', position });
      paletteRoutes();
      const { user } = await renderWithFocusedCard();

      await openPalette(user);
      await user.keyboard(`${typed}{Enter}`);

      await waitFor(() => {
        expect(document.documentElement.dataset.theme).toBe('dark');
      });
      expect(push).not.toHaveBeenCalled();
    },
  );

  it.each([
    { moment: 'inside the debounce', asked: 0 },
    { moment: 'while its request is held', asked: 1 },
  ])('Enter on a new query $moment opens nothing the previous one found', async ({ asked }) => {
    const user = await findRoku({ Roku: ROKU_FOUND });
    const held = latch();
    const next = pagedListRoute({ items: foundAs(ZETA), latch: held });
    server.use(next.handler);

    await user.keyboard('{Backspace>4/}Zeta');
    await waitFor(() => {
      expect(next.sent).toHaveLength(asked);
    }, SEARCH_WAIT);
    await user.keyboard('{Enter}');
    held.release();
    await within(groupNamed('Вакансії')).findByRole('option', { name: /QA Lead/ }, SEARCH_WAIT);

    expect(push).not.toHaveBeenCalled();
  });

  it('a result the new query finds again opens on Enter once its answer arrives', async () => {
    const user = await findRoku({ Roku: ROKU_FOUND, Mobile: ROKU_FOUND });

    await user.keyboard('{Backspace>4/}Mobile');
    await waitFor(() => {
      expect(within(groupNamed('Вакансії')).getByRole('option').getAttribute('aria-disabled')).toBe(
        'false',
      );
    }, SEARCH_WAIT);
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(`/applications/${ROKU.id}`);
    });
  });

  it('reads «Недавні» once per opening, so a storage that refuses warns once while typing', async () => {
    const warn = refuseStorage();
    paletteRoutes();
    const { user } = await renderWithFocusedCard();

    await openPalette(user);
    await user.keyboard('тем');

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('«кщ» that the server finds nothing for is asked again as «ro», and Roku shows under «Вакансії»', async () => {
    const { asked } = paletteRoutes({ ro: ROKU_FOUND });
    const { user } = await renderWithFocusedCard();

    await openPalette(user);
    await user.keyboard('кщ');
    await within(await screen.findByRole('group', { name: 'Вакансії' }, SEARCH_WAIT)).findByRole(
      'option',
      { name: /Mobile Engineer/ },
    );

    expect(asked()).toEqual(['кщ', 'ro']);
  });

  it('passes axe with results and recent applications, and on the move list', async () => {
    rememberRecent({ id: fixtureIdOf(302), company: 'Roku', position: 'Data Engineer' });

    const user = await findRoku({ Roku: ROKU_FOUND });
    expect(await axeViolations()).toEqual([]);
    await user.keyboard('{Backspace>4/}Перемістити в…{Enter}');
    await screen.findByPlaceholderText('Куди перемістити Trident Systems?');

    expect(await axeViolations()).toEqual([]);
  });
});
