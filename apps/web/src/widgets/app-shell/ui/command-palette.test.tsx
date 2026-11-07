import {
  type ApplicationListItem,
  type BoardCard,
  moveApplicationInputSchema,
} from '@jobflow/shared';
import { act, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applicationKeys } from '@/entities/application';
import { userKeys } from '@/entities/user';
import { uk } from '@/shared/i18n';
import { applicationRoute } from '@/test/application-fixtures';
import { axeViolations } from '@/test/axe';
import {
  applicationResponseOf,
  DESIGN_BOARD,
  fixtureIdOf,
  moveRoute,
  reasonsSummaryRoute,
} from '@/test/board-fixtures';
import { flagSwitch } from '@/test/feature-flags';
import { listItemsIn, pagedListRoute } from '@/test/list-fixtures';
import { push, route } from '@/test/navigation';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import { renderBoardInShell, renderInShell } from '@/test/render-in-shell';
import { server } from '@/test/server';
import { ME_RESPONSE } from '@/test/session-fixtures';

import { rememberRecentApplication } from '../model/recent-applications';

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

const ROKU_FOUND = listItemsIn({ stage: 'screening', count: 1, from: 301 }).map((item) => ({
  ...item,
  ...ROKU,
}));

const SEARCH_WAIT = { timeout: 3000 };

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

async function renderSignedIn(page: ReactNode) {
  const user = renderInShell(
    <>
      {page}
      <QueryProbe queryKey={userKeys.me()} />
    </>,
  );
  await waitForQuery({ queryKey: userKeys.me(), status: 'success' });
  return user;
}

async function renderWithFocusedCard() {
  const user = await renderSignedIn(<a href={CARD_PAGE}>{CARD.position}</a>);
  const card = cardLink();
  act(() => {
    card.focus();
  });
  return { user, card };
}

async function openPalette(user: UserEvent) {
  await user.keyboard('{Control>}k{/Control}');
  return screen.findByRole('dialog', { name: 'Палітра команд' });
}

async function choose(user: UserEvent, label: string) {
  await openPalette(user);
  await user.keyboard(label);
  await screen.findByRole('option', { name: label });
  await user.keyboard('{Enter}');
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

  it.each([
    { typed: 'кален', href: '/calendar' },
    { typed: 'rfktyl', href: '/calendar' },
    { typed: 'табл', href: '/applications' },
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
    rememberRecentApplication({ userId: ME_RESPONSE.user.id, application: ROKU });
    paletteRoutes();
    const { user } = await renderWithFocusedCard();

    await openPalette(user);
    await user.keyboard('кщ');

    expect(within(groupNamed('Недавні')).getByRole('option').textContent).toBe(
      'Mobile EngineerRoku',
    );
  });

  it('«тему» and Enter switch the theme, not open a recent «Frontend Developer» that «ntve» only spells in scattered letters', async () => {
    rememberRecentApplication({
      userId: ME_RESPONSE.user.id,
      application: { id: fixtureIdOf(303), company: 'Acme', position: 'Frontend Developer' },
    });
    paletteRoutes();
    const { user } = await renderWithFocusedCard();

    await openPalette(user);
    await user.keyboard('тему{Enter}');

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
    });
    expect(push).not.toHaveBeenCalled();
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
    rememberRecentApplication({
      userId: ME_RESPONSE.user.id,
      application: { id: fixtureIdOf(302), company: 'Roku', position: 'Data Engineer' },
    });
    paletteRoutes({ Roku: ROKU_FOUND });
    const { user } = await renderWithFocusedCard();

    await openPalette(user);
    await user.keyboard('Roku');
    await within(await screen.findByRole('group', { name: 'Вакансії' }, SEARCH_WAIT)).findByRole(
      'option',
    );
    expect(await axeViolations()).toEqual([]);
    await user.keyboard('{Backspace>4/}Перемістити в…{Enter}');
    await screen.findByPlaceholderText('Куди перемістити Trident Systems?');

    expect(await axeViolations()).toEqual([]);
  });
});
