import { designInsightsBody } from '@jobflow/shared/testing';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import { frameOf, renderDashboardBlocks } from '@/test/dashboard-frames';
import { advancePastQueryRetries, fakeTimeouts } from '@/test/fake-timeouts';
import { latch } from '@/test/latch';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('react-chartjs-2', () => import('@/test/recorded-chart'));

const PANEL = 'що зробити';

const LIST = 'Що зробити далі';

const DESIGN_ACTIONS = [
  [
    '1',
    "Підготуватися до наступного техінтерв'ю",
    'Прогноз офера звузиться до діапазону від 3 до 11 тижнів, якщо конверсія дійде до 60%.',
  ],
  [
    '2',
    'Прибрати LinkedIn з рутини',
    'Ті самі 16 відгуків через Djinni дали б 6 скринінгів замість 2.',
  ],
  [
    '3',
    'Попросити ще кілька рефералок',
    '3 скринінги на 3 відгуки через рефералки. Вибірка мала, але напрям однозначний.',
  ],
  ['4', 'Відгукуватися з CV v2', 'Конверсія у скринінг 41% проти 24% до переходу на CV v2.'],
];

function actionsShown(): (string | null)[][] {
  const list = within(frameOf(PANEL)).getByRole('list', { name: LIST });
  return within(list)
    .getAllByRole('listitem')
    .map((item) => [...item.querySelectorAll('span, p')].map(({ textContent }) => textContent));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('WhatToDoPanel', () => {
  it('lists the four actions of the 54 application search in order, each with its expected effect, and offers no plan buttons yet', async () => {
    renderDashboardBlocks();

    await waitFor(() => {
      expect(actionsShown()).toEqual(DESIGN_ACTIONS);
    });
    expect(within(frameOf(PANEL)).queryAllByRole('button')).toEqual([]);
  });

  it('shows a skeleton while the insights load', async () => {
    const held = latch();
    renderDashboardBlocks({
      insights: async () => {
        await held.reached;
        return undefined;
      },
    });

    await waitFor(() => {
      expect(frameOf(PANEL).querySelector('[aria-busy="true"]')).not.toBeNull();
    });
    held.release();
    await waitFor(() => {
      expect(actionsShown()).toHaveLength(4);
    });
  });

  it('with no action to advise the panel is absent', async () => {
    const { insights } = designInsightsBody();
    renderDashboardBlocks({ insights: { insights, actions: [] } });

    expect(await screen.findByRole('heading', { name: 'Схоже, CV v2 працює краще' })).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByText(PANEL)).toBeNull();
    });
  });

  it('a failed insights request shows the error with a retry that asks for the insights again', async () => {
    fakeTimeouts();
    const down = { on: true };
    const { user, sent } = renderDashboardBlocks({
      insights: () => (down.on ? errorReply({ status: 500, type: 'internal_error' }) : undefined),
    });
    await advancePastQueryRetries();
    await waitFor(() => {
      expect(within(frameOf(PANEL)).queryByRole('alert')).not.toBeNull();
    });
    down.on = false;
    sent.length = 0;

    await user.click(within(frameOf(PANEL)).getByRole('button', { name: 'Спробувати ще раз' }));

    await waitFor(() => {
      expect(actionsShown()).toEqual(DESIGN_ACTIONS);
    });
    expect(sent.map(({ route }) => route)).toEqual(['insights']);
  });
});
