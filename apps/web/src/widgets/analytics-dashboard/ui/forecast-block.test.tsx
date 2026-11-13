import { buildForecast } from '@jobflow/shared/testing';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { HttpResponseResolver } from 'msw';
import { HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ARCHIVED_SEARCH, type SentRequest } from '@/test/analytics-fixtures';
import { axeViolations } from '@/test/axe';
import { frameOf, renderDashboardBlocks, selectArchivedSearch } from '@/test/dashboard-frames';
import { advanceBy, fakeTimeouts } from '@/test/fake-timeouts';
import {
  DESIGN_FORECAST_TEXT,
  forecastBelowThreshold,
  NO_REPLY_FORECAST,
  WHAT_IF_FORECAST,
  WHAT_IF_TEXT,
} from '@/test/forecast-fixtures';
import { latch } from '@/test/latch';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('react-chartjs-2', () => import('@/test/recorded-chart'));

const FRAME = 'прогноз офера';

const RATE = 'Відгуків на тиждень';

const TECH = "Якщо конверсія техінтерв'ю дійде до 60%";

const DEBOUNCE_MS = 150;

type HeldWhen = (params: URLSearchParams) => boolean;

function forecastReply(hold: { until: Promise<void>; when: HeldWhen }): HttpResponseResolver {
  return async ({ request }) => {
    const params = new URL(request.url).searchParams;
    if (hold.when(params)) await hold.until;
    return HttpResponse.json(
      params.has('applicationsPerWeek') ? WHAT_IF_FORECAST : buildForecast(),
    );
  };
}

function forecastQueries(sent: readonly SentRequest[]) {
  return sent.filter(({ route }) => route === 'forecast').map(({ url }) => url.search);
}

async function shownForecast() {
  await screen.findByText(DESIGN_FORECAST_TEXT.headline);
  return within(frameOf(FRAME));
}

function stepRate(values: readonly string[]) {
  const slider = screen.getByRole('slider', { name: RATE });
  slider.focus();
  values.forEach((value) => {
    fireEvent.change(slider, { target: { value } });
  });
}

function renderHeld(when: HeldWhen) {
  const held = latch();
  const rendered = renderDashboardBlocks({
    forecast: forecastReply({ until: held.reached, when }),
  });
  return { ...rendered, held };
}

beforeEach(() => {
  fakeTimeouts();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ForecastBlock', () => {
  it('reads the 28 application forecast as drawn: corridor headline, legend, both odds and what the model saw', async () => {
    renderDashboardBlocks();
    const frame = await shownForecast();

    expect(frame.getByText(DESIGN_FORECAST_TEXT.caption)).toBeDefined();
    expect(frame.getAllByRole('listitem').map((item) => item.textContent)).toEqual(
      DESIGN_FORECAST_TEXT.legend,
    );
    expect(frame.getByText(DESIGN_FORECAST_TEXT.odds)).toBeDefined();
    expect(frame.getByText(DESIGN_FORECAST_TEXT.note)).toBeDefined();
    expect(frame.getByRole('slider', { name: RATE })).toHaveProperty('value', '2');
    expect(frame.getByText('2,0')).toBeDefined();
  });

  it('an observed pace above the slider range starts the slider and its value at 10, so the label and the thumb agree', async () => {
    renderDashboardBlocks({ forecast: { ...buildForecast(), applicationsPerWeek: 18 } });
    await screen.findByText(DESIGN_FORECAST_TEXT.headline);
    const frame = within(frameOf(FRAME));

    const slider = frame.getByRole('slider', { name: RATE });
    expect(slider).toHaveProperty('value', '10');
    expect(slider.getAttribute('aria-valuetext')).toBe('10,0 на тиждень');
    expect(frame.getByText('10,0')).toBeDefined();
  });

  it('an observed pace of 2.3 reads 2,5 in the caption and on the slider, the step the slider starts at', async () => {
    renderDashboardBlocks({ forecast: { ...buildForecast(), applicationsPerWeek: 2.3 } });
    const frame = await shownForecast();

    expect(
      frame.getByText(
        'Ймовірний коридор: половина симуляцій. Темп 2,5 на тиждень, поточні конверсії.',
      ),
    ).toBeDefined();
    expect(frame.getByRole('slider', { name: RATE })).toHaveProperty('value', '2.5');
    expect(frame.getByText('2,5')).toBeDefined();
  });

  it('a corridor from 0.4 to 2.5 weeks reads from 1 to 3 weeks, the range the stage action prints', async () => {
    renderDashboardBlocks({ forecast: { ...buildForecast(), likely: { low: 0.4, high: 2.5 } } });

    expect(await within(frameOf(FRAME)).findByText('1–3 тижні')).toBeDefined();
  });

  it('three quick slider steps send one request after the debounce and keep the old band until the new range arrives', async () => {
    const { sent, held } = renderHeld((params) => params.has('applicationsPerWeek'));
    const frame = await shownForecast();
    sent.length = 0;

    stepRate(['2.5', '3', '2.5']);

    expect(forecastQueries(sent)).toEqual([]);
    expect(frame.getByText('2,5')).toBeDefined();
    await advanceBy(DEBOUNCE_MS);
    await waitFor(() => {
      expect(forecastQueries(sent)).toEqual(['?applicationsPerWeek=2.5']);
    });
    expect(frame.getByText(DESIGN_FORECAST_TEXT.headline)).toBeDefined();
    expect(frameOf(FRAME).querySelector('[aria-busy="true"]')).toBeNull();
    held.release();
    expect(await frame.findByText(WHAT_IF_TEXT.headline)).toBeDefined();
    expect(frame.getByText(WHAT_IF_TEXT.likely)).toBeDefined();
  });

  it('the tech interview switch sends the 60% conversion, and switching it off drops the param', async () => {
    const { user, sent } = renderDashboardBlocks();
    await shownForecast();
    sent.length = 0;

    await user.click(screen.getByRole('switch', { name: TECH }));
    stepRate(['2.5']);
    await advanceBy(DEBOUNCE_MS);
    await waitFor(() => {
      expect(forecastQueries(sent)).toEqual([
        '?applicationsPerWeek=2.5&improve=tech_interview%3A0.6',
      ]);
    });
    await user.click(screen.getByRole('switch', { name: TECH }));
    await advanceBy(DEBOUNCE_MS);

    await waitFor(() => {
      expect(forecastQueries(sent).at(-1)).toBe('?applicationsPerWeek=2.5');
    });
    expect(screen.getByRole('switch', { name: TECH }).getAttribute('aria-checked')).toBe('false');
  });

  it('under 15 applications the block counts what is missing and says why a forecast now would be noise', async () => {
    renderDashboardBlocks({ forecast: forecastBelowThreshold(12) });

    await screen.findByRole('heading', { name: 'Ще 3 відгуки до прогнозу' });
    const frame = within(frameOf(FRAME));
    expect(
      frame.getByText(
        'Раніше він показував би «2–30 тижнів». Це не інформація, а тривога. Краще нічого.',
      ),
    ).toBeDefined();
    const meter = frame.getByRole('meter', { name: 'Прогрес до прогнозу' });
    expect(meter.getAttribute('aria-valuenow')).toBe('12');
    expect(meter.getAttribute('aria-valuemax')).toBe('15');
    expect(frame.queryByRole('slider')).toBeNull();
  });

  it('enough applications but no reply yet shows the service message instead of a forecast', async () => {
    renderDashboardBlocks({ forecast: NO_REPLY_FORECAST });

    expect(
      await screen.findByText("Прогноз з'явиться після першої відповіді компанії"),
    ).toBeDefined();
    expect(within(frameOf(FRAME)).queryByRole('slider')).toBeNull();
  });

  it('the method popover opens from the keyboard and names the 10 000 simulations', async () => {
    const { user } = renderDashboardBlocks();
    const frame = await shownForecast();

    frame.getByRole('button', { name: 'Як рахується прогноз' }).focus();
    await user.keyboard('{Enter}');

    const method = await screen.findByRole('dialog', { name: 'Як рахується прогноз' });
    expect(within(method).getByText('10 000 симуляцій на твоїх даних')).toBeDefined();
  });

  it('switching to the archived search resets the what-if and never shows the current search forecast meanwhile', async () => {
    const { user, sent, held } = renderHeld((params) => params.has('searchId'));
    const frame = await shownForecast();
    stepRate(['2.5']);
    await advanceBy(DEBOUNCE_MS);
    await frame.findByText(WHAT_IF_TEXT.headline);
    sent.length = 0;

    await selectArchivedSearch(user);

    await waitFor(() => {
      expect(forecastQueries(sent)).toEqual([`?searchId=${ARCHIVED_SEARCH.id}`]);
    });
    expect(frameOf(FRAME).querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(frame.queryByText(WHAT_IF_TEXT.headline)).toBeNull();
    held.release();
    expect(await frame.findByText(DESIGN_FORECAST_TEXT.headline)).toBeDefined();
    expect(frame.getByRole('slider', { name: RATE })).toHaveProperty('value', '2');
  });

  it('the forecast block has no axe violations', async () => {
    renderDashboardBlocks();
    await shownForecast();

    expect(await axeViolations(frameOf(FRAME))).toEqual([]);
  });
});
