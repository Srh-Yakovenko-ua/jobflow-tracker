import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ChartTable, type ChartTableProps } from './chart-table';
import { TOUCH_HEIGHT } from './touch-height';

const TABLE: ChartTableProps = {
  caption: 'Причини відмов',
  heads: ['причина', 'відмов'],
  rows: [{ key: 'skills_gap', cells: [{ text: 'не вистачає скілів' }, { text: '3' }] }],
};

function stateOf(toggle: HTMLElement) {
  const table = screen.getByRole('table', { name: TABLE.caption });
  return {
    name: toggle.textContent,
    expanded: toggle.getAttribute('aria-expanded'),
    controlsTable: toggle.getAttribute('aria-controls') === table.parentElement?.id,
    hidden: table.parentElement?.classList.contains('sr-only'),
    focused: document.activeElement === toggle,
  };
}

describe('ChartTable', () => {
  it('a visible toggle shows and hides the data table, which screen readers read in both states, and keeps the focus', async () => {
    const user = userEvent.setup();
    render(<ChartTable {...TABLE} />);
    const toggle = screen.getByRole('button', { name: 'Показати таблицю' });

    expect(stateOf(toggle)).toEqual({
      name: 'Показати таблицю',
      expanded: 'false',
      controlsTable: true,
      hidden: true,
      focused: false,
    });

    await user.tab();
    await user.keyboard('{Enter}');
    expect(stateOf(toggle)).toEqual({
      name: 'Сховати таблицю',
      expanded: 'true',
      controlsTable: true,
      hidden: false,
      focused: true,
    });

    await user.keyboard('{Enter}');
    expect(stateOf(toggle)).toEqual({
      name: 'Показати таблицю',
      expanded: 'false',
      controlsTable: true,
      hidden: true,
      focused: true,
    });
  });

  it('the toggle grows to the 44 px touch height below md', () => {
    render(<ChartTable {...TABLE} />);

    expect(
      screen.getByRole('button', { name: 'Показати таблицю' }).classList.contains(TOUCH_HEIGHT),
    ).toBe(true);
  });

  it('the shown table scrolls inside a keyboard focusable region named by its caption, and the hidden one adds no tab stop', async () => {
    const user = userEvent.setup();
    render(<ChartTable {...TABLE} />);
    expect(screen.queryByRole('region')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Показати таблицю' }));
    const region = screen.getByRole('region', { name: TABLE.caption });

    expect({
      tabIndex: region.getAttribute('tabindex'),
      holdsTable: region === screen.getByRole('table').parentElement,
    }).toEqual({ tabIndex: '0', holdsTable: true });
  });
});
