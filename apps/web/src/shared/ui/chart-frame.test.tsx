import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChartFrame, type ChartFrameState } from './chart-frame';

const HEADER = { eyebrow: 'Відгуки та скринінги', title: 'Темп пошуку' };

const PLOT = 'полотно чарту';

const ACTION = 'перемикач';

const HERO_VIEW = { plot: 'hero', actions: <button type="button">{ACTION}</button> } as const;

function heroFrame(state: ChartFrameState) {
  return (
    <ChartFrame header={HEADER} state={state} view={HERO_VIEW}>
      <p>{PLOT}</p>
    </ChartFrame>
  );
}

function renderFrame(state: ChartFrameState) {
  render(
    <ChartFrame header={HEADER} state={state}>
      <p>{PLOT}</p>
    </ChartFrame>,
  );
  const frame = screen.getByRole('region', { name: HEADER.title });
  expect(within(frame).getByText(HEADER.eyebrow)).toBeDefined();
  return frame;
}

describe('ChartFrame', () => {
  it('shows equal-height skeleton bars, hidden from screen readers, and says it is loading', () => {
    const frame = renderFrame({ status: 'loading' });

    expect(frame.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(within(frame).getByRole('status').textContent).toBe('Завантаження…');
    const plot = frame.querySelector('[aria-hidden="true"]');
    expect(plot?.children).toHaveLength(5);
    for (const bar of plot?.children ?? []) expect(bar.className).toContain('h-[52%]');
    expect(within(frame).queryByText(PLOT)).toBeNull();
  });

  it('shows how many records are missing before the chart can say anything', () => {
    const frame = renderFrame({
      status: 'insufficient_data',
      have: 4,
      need: 10,
      message: 'Перші висновки з 10 відгуків. Зараз 4.',
    });

    expect(within(frame).getByRole('heading', { name: 'Мало даних' })).toBeDefined();
    expect(within(frame).getByText('Перші висновки з 10 відгуків. Зараз 4.')).toBeDefined();
    const meter = within(frame).getByRole('meter', { name: 'Прогрес до першого висновку' });
    expect(meter.getAttribute('aria-valuenow')).toBe('4');
    expect(meter.getAttribute('aria-valuemax')).toBe('10');
    expect(within(frame).queryByText(PLOT)).toBeNull();
  });

  it('a failed load explains the failure and retries on the button', async () => {
    const onRetry = vi.fn();
    const frame = renderFrame({ status: 'failed', onRetry });

    expect(within(frame).getByRole('alert').textContent).toContain('Не вдалося завантажити');
    await userEvent.click(within(frame).getByRole('button', { name: 'Спробувати ще раз' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(within(frame).queryByText(PLOT)).toBeNull();
  });

  it('draws the chart once the data is ready', () => {
    const frame = renderFrame({ status: 'ready' });

    expect(within(frame).getByText(PLOT)).toBeDefined();
    expect(frame.querySelector('[aria-busy]')).toBeNull();
    expect(within(frame).queryByRole('alert')).toBeNull();
  });

  it('a hero plot loads at the 380 px canvas height and hands the ready body to the chart unwrapped', () => {
    const { rerender } = render(heroFrame({ status: 'loading' }));
    const frame = screen.getByRole('region', { name: HEADER.title });

    expect(frame.querySelector('[aria-hidden="true"]')?.className).toContain('h-95');

    rerender(heroFrame({ status: 'ready' }));

    expect(within(frame).getByText(PLOT).parentElement?.className).not.toContain('h-55');
  });

  it('keeps the header actions mounted and focused while the body loads, fails and draws', async () => {
    const { rerender } = render(heroFrame({ status: 'ready' }));
    await userEvent.tab();
    const action = screen.getByRole('button', { name: ACTION });
    expect(document.activeElement).toBe(action);

    rerender(heroFrame({ status: 'loading' }));
    expect(document.activeElement).toBe(action);

    rerender(heroFrame({ status: 'failed', onRetry: vi.fn() }));
    expect(screen.getByRole('alert')).toBeDefined();
    expect(document.activeElement).toBe(action);

    rerender(heroFrame({ status: 'ready' }));
    expect(screen.getByText(PLOT)).toBeDefined();
    expect(document.activeElement).toBe(action);
  });
});
