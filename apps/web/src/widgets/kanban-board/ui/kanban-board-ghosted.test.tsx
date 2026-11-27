import type { BoardCard, TimingsResponse } from '@jobflow/shared';
import { INSUFFICIENT_RATES } from '@jobflow/shared/testing';
import { screen, waitFor, within } from '@testing-library/react';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { analyticsUrl, NEVER_ANSWERS, REFUSED_CONNECTION } from '@/test/api-handlers';
import { fixtureIdOf, GHOSTED_CARDS, ghostIn, ghostTimingsOf } from '@/test/board-fixtures';
import { advancePastQueryRetries, fakeTimeouts } from '@/test/fake-timeouts';
import { followupRoutes } from '@/test/followup-fixtures';
import { renderBoard } from '@/test/render-board';
import { server } from '@/test/server';

vi.mock('next/link', () => import('@/test/link'));
vi.mock('next/navigation', () => import('@/test/navigation'));

const SUPPORTIVE = 'Вони не входять у конверсії.';

const SHARE = 'Це 31% твоїх відгуків';

const DONE_LINE = 'AI пише 2 з 2 листів';

type GhostedSetup = Readonly<{
  cards?: readonly BoardCard[];
  timings?: HttpResponseResolver;
}>;

const timingsReply = (timings: TimingsResponse) => () => HttpResponse.json(timings);

const LOW_GHOST_DATA: TimingsResponse = {
  ...ghostTimingsOf(null),
  ghostRate: { ...ghostTimingsOf(null).ghostRate, rate: INSUFFICIENT_RATES.twoMore },
};

afterEach(() => {
  vi.useRealTimers();
});

async function openGhosted({
  cards = GHOSTED_CARDS,
  timings = timingsReply(ghostTimingsOf({ position: 'below', points: 7 })),
}: GhostedSetup = {}) {
  const followup = followupRoutes({});
  server.use(http.get(analyticsUrl('/analytics/timings'), timings), ...followup.handlers);
  const { user } = renderBoard({ counts: { ghosted: cards.length }, cards });
  await user.click(await screen.findByRole('button', { name: `ghosted ${String(cards.length)}` }));
  await screen.findByText(/^ghosted · /);
  return { user, sent: followup.sent };
}

describe('KanbanBoard ghosted lane', () => {
  it.each([
    { position: 'below', points: 7, market: `${SHARE}, на 7 п.п. менше за ринок.` },
    { position: 'above', points: 9, market: `${SHARE}, на 9 п.п. більше за ринок.` },
    { position: 'within', points: 0, market: `${SHARE}, у межах ринку.` },
  ] as const)(
    'the expanded lane says how many went silent and compares the ghost rate with the market: $position',
    async ({ position, points, market }) => {
      await openGhosted({ timings: timingsReply(ghostTimingsOf({ position, points })) });

      expect(screen.getByText('ghosted · 5 карток')).toBeDefined();
      expect(screen.getByRole('heading', { name: '5 компаній не відповіли' })).toBeDefined();
      expect(await screen.findByText(`${market} ${SUPPORTIVE}`)).toBeDefined();
    },
  );

  it('a missing gap reads as within the market', async () => {
    await openGhosted({ timings: timingsReply(ghostTimingsOf(null)) });

    expect(await screen.findByText(`${SHARE}, у межах ринку. ${SUPPORTIVE}`)).toBeDefined();
  });

  it('with too little data shows only the supportive sentence', async () => {
    await openGhosted({ timings: timingsReply(LOW_GHOST_DATA) });

    await waitFor(() => {
      expect(screen.getByText(SUPPORTIVE)).toBeDefined();
    });
    expect(screen.queryByText(new RegExp(SHARE))).toBeNull();
  });

  it.each([REFUSED_CONNECTION, NEVER_ANSWERS])(
    'when analytics $name only the supportive sentence shows and the follow-up still works',
    async ({ reply }) => {
      fakeTimeouts();
      await openGhosted({ timings: reply });

      await advancePastQueryRetries();

      expect(screen.getByText(SUPPORTIVE)).toBeDefined();
      expect(
        screen.getByRole('button', { name: 'Написати фоллоу-ап для 2 свіжих карток' }),
      ).toBeDefined();
    },
  );

  it('the button names the exact fresh count and creates exactly that many drafts', async () => {
    const { user, sent } = await openGhosted();

    await user.click(
      screen.getByRole('button', { name: 'Написати фоллоу-ап для 2 свіжих карток' }),
    );

    const sheet = await screen.findByRole('dialog', { name: 'Фоллоу-апи для ghosted' });
    await waitFor(() => {
      expect(sent.posted).toHaveLength(2);
    });
    expect(sent.posted.map((request) => request.id)).toEqual([fixtureIdOf(201), fixtureIdOf(202)]);
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(2);
    expect(sent.marked).toEqual([]);
  });

  it('once started, the same button reopens the list instead of queueing the drafts again', async () => {
    const { user, sent } = await openGhosted();
    const action = { name: 'Написати фоллоу-ап для 2 свіжих карток' };

    await user.click(screen.getByRole('button', action));
    const sheet = await screen.findByRole('dialog', { name: 'Фоллоу-апи для ghosted' });
    await within(sheet).findByText(DONE_LINE);
    await user.click(within(sheet).getByRole('button', { name: 'Закрити' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await user.click(screen.getByRole('button', action));

    const reopened = await screen.findByRole('dialog', { name: 'Фоллоу-апи для ghosted' });
    expect(within(reopened).getByText(DONE_LINE)).toBeDefined();
    expect(sent.posted).toHaveLength(2);
  });

  it('hides the button when no ghost is fresh', async () => {
    await openGhosted({
      cards: [ghostIn({ serial: 203, days: 45 }), ghostIn({ serial: 204, days: 60 })],
    });

    expect(screen.getByText('ghosted · 2 картки')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Написати фоллоу-ап/ })).toBeNull();
  });
});
