import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { Button } from './button';
import { EmptyState } from './empty-state';

const ANALYTICS = uk.devUi.emptyScreens.analytics.content;

const COMPACT = uk.devUi.banners.compactEmpty;

describe('EmptyState', () => {
  it('a 4 of 10 meter fills four of ten segments and reads 4 / 10', () => {
    render(<EmptyState content={ANALYTICS} progress={{ count: 4, goal: 10 }} />);
    const meter = screen.getByRole('meter', { name: 'Прогрес до першого висновку' });

    expect(meter.getAttribute('aria-valuenow')).toBe('4');
    expect(meter.getAttribute('aria-valuemax')).toBe('10');
    expect(meter.querySelectorAll('.bg-stage-screening')).toHaveLength(4);
    expect(meter.querySelectorAll('.bg-line-soft')).toHaveLength(6);
    expect(screen.getByText('4 / 10').className).toContain('tabular-nums');
  });

  it('shows no meter when nothing is counted toward a first result', () => {
    render(<EmptyState content={ANALYTICS} />);

    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('states the fact as a heading, then the hint and the one action', () => {
    render(
      <EmptyState
        content={{ title: COMPACT.title, hint: COMPACT.hint }}
        slots={{ action: <Button size="sm">{COMPACT.action}</Button> }}
        view={{ size: 'compact' }}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Порахувати ще нічого' })).toBeDefined();
    expect(
      screen.getByText('Перші висновки — на 10 відгуках, прогноз — на 15. Зараз 4.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Додати вакансію' })).toBeDefined();
  });

  it('puts the figure before the text on a page and after it on a panel', () => {
    const figure = <span data-testid="figure" />;
    const { container, rerender } = render(
      <EmptyState content={ANALYTICS} slots={{ figure }} view={{ size: 'page' }} />,
    );
    expect(container.firstElementChild?.firstElementChild?.getAttribute('data-testid')).toBe(
      'figure',
    );

    rerender(<EmptyState content={ANALYTICS} slots={{ figure }} />);
    expect(container.firstElementChild?.lastElementChild?.getAttribute('data-testid')).toBe(
      'figure',
    );
  });

  it('keeps the screen panels square and rounds only the compact one to 10 px', () => {
    const { container, rerender } = render(<EmptyState content={ANALYTICS} />);
    expect(container.firstElementChild?.className).not.toContain('rounded');

    rerender(<EmptyState content={ANALYTICS} view={{ size: 'compact' }} />);
    expect(container.firstElementChild?.className).toContain('rounded-[10px]');
  });
});
