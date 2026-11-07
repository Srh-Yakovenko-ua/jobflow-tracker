import { render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';
import { axeViolations } from '@/test/axe';

import { Calendar, type CalendarDays, type CalendarDone } from './calendar';

const COPY = uk.calendar;

const DESIGN_DAYS: CalendarDays = {
  today: '2026-09-07',
  marked: { '2026-09-01': 1, '2026-09-03': 1, '2026-09-11': 2, '2026-09-16': 4 },
};

const TABS_TO_GRID = 5;

type CalendarSetup = { value?: string | null; days?: CalendarDays; done?: CalendarDone };

function renderCalendar({ value = '2026-09-03', days = DESIGN_DAYS, done }: CalendarSetup = {}) {
  const picked: string[] = [];
  function Harness() {
    const [selected, setSelected] = useState(value);
    const onSelect = (day: string) => {
      picked.push(day);
      setSelected(day);
    };
    return (
      <Calendar selection={{ value: selected, onSelect }} days={days} {...(done && { done })} />
    );
  }
  render(
    <main>
      <Harness />
    </main>,
  );
  return { user: userEvent.setup(), picked };
}

function dayNamed(date: string): HTMLElement {
  return screen.getByRole('gridcell', { name: (name) => name.includes(`, ${date}`) });
}

function shownMonth(): string | null {
  return screen.getByRole('grid').getAttribute('aria-label');
}

async function tabToGrid(user: UserEvent) {
  for (let step = 0; step < TABS_TO_GRID; step += 1) await user.tab();
  expect(document.activeElement?.getAttribute('role')).toBe('gridcell');
}

describe('Calendar days', () => {
  it('draws the design month from Monday with 35 cells, today marked and the value selected', () => {
    renderCalendar();

    expect(shownMonth()).toBe('вересень 2026');
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'пн',
      'вт',
      'ср',
      'чт',
      'пт',
      'сб',
      'нд',
    ]);
    const cells = screen.getAllByRole('gridcell');
    expect(cells).toHaveLength(35);
    expect(cells[0]?.getAttribute('aria-label')).toBe('понеділок, 31 серпня 2026 р.');
    expect(dayNamed('7 вересня 2026').getAttribute('aria-current')).toBe('date');
    expect(screen.getByRole('gridcell', { selected: true })).toBe(dayNamed('3 вересня 2026'));
    expect(screen.getByText('03.09.2026').parentElement?.textContent).toBe(
      `${COPY.selected} 03.09.2026`,
    );
  });

  it('keeps every row in a rowgroup, the weekday header in the first', () => {
    renderCalendar();

    const groups = within(screen.getByRole('grid')).getAllByRole('rowgroup');

    expect(groups).toHaveLength(2);
    expect(within(groups[0] ?? document.body).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(groups[1] ?? document.body).getAllByRole('row')).toHaveLength(5);
  });

  it('grows to 42 cells for a month that needs a sixth row', () => {
    renderCalendar({ value: '2026-03-10' });

    expect(shownMonth()).toBe('березень 2026');
    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
  });

  it('a click picks the day, moves the selection and the value line', async () => {
    const { user, picked } = renderCalendar();

    const marked = dayNamed('11 вересня 2026');
    expect(marked.getAttribute('aria-label')).toBe(
      `пʼятниця, 11 вересня 2026 р., ${COPY.hasEvents}`,
    );
    await user.click(marked);

    expect(picked).toEqual(['2026-09-11']);
    expect(dayNamed('11 вересня 2026').getAttribute('aria-selected')).toBe('true');
    expect(dayNamed('3 вересня 2026').getAttribute('aria-selected')).toBe('false');
    expect(screen.getByText('11.09.2026')).toBeDefined();
  });

  it('a day with events carries a dot, denser past three, and the selected day drops it', () => {
    renderCalendar();

    const dotOf = (date: string) => dayNamed(date).querySelector('[data-dot]');
    expect(dotOf('11 вересня 2026')?.getAttribute('data-dot')).toBe('single');
    expect(dotOf('16 вересня 2026')?.getAttribute('data-dot')).toBe('dense');
    expect(dotOf('16 вересня 2026')?.classList.contains('size-1.5')).toBe(true);
    expect(dotOf('11 вересня 2026')?.classList.contains('size-1')).toBe(true);
    expect(dotOf('3 вересня 2026')).toBeNull();
    expect(dotOf('4 вересня 2026')).toBeNull();
    expect(screen.getByText(COPY.marked)).toBeDefined();
  });

  it('the header controls carry the 44 px touch target and a day grows to 44 px below sm', () => {
    renderCalendar();

    const controls = [COPY.previousMonth, 'вересень', '2026', COPY.nextMonth].map((name) =>
      screen.getByRole('button', { name }),
    );
    expect(controls.filter((control) => control.classList.contains('touch-target'))).toEqual(
      controls,
    );
    const heights = [...dayNamed('7 вересня 2026').classList].filter((name) =>
      /^(sm:)?h-/.test(name),
    );
    expect(heights).toEqual(['h-11', 'sm:h-8.5']);
  });

  it('has no axe violations on the days panel', async () => {
    renderCalendar({ done: { onDone: () => undefined } });

    expect(await axeViolations()).toEqual([]);
  });
});

describe('Calendar bounds', () => {
  it.each([
    {
      name: 'below min',
      days: { today: '2026-09-07', min: '2026-09-07' },
      blocked: '3 вересня 2026',
    },
    {
      name: 'above max',
      days: { today: '2026-09-07', max: '2026-09-07' },
      blocked: '8 вересня 2026',
    },
  ])('a day $name stays blocked for click, Enter and Space', async ({ days, blocked }) => {
    const { user, picked } = renderCalendar({ value: null, days });

    await user.click(dayNamed(blocked));
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(picked).toEqual([]);
    expect(document.activeElement).toBe(dayNamed(blocked));
    expect(dayNamed(blocked).getAttribute('aria-disabled')).toBe('true');
    expect(dayNamed('7 вересня 2026').hasAttribute('aria-disabled')).toBe(false);
  });

  it('Сьогодні selects today and brings the view back to its month', async () => {
    const { user, picked } = renderCalendar({ value: '2026-03-10' });

    await user.click(screen.getByRole('button', { name: COPY.today }));

    expect(picked).toEqual(['2026-09-07']);
    expect(shownMonth()).toBe('вересень 2026');
    expect(screen.getByText('07.09.2026')).toBeDefined();
  });

  it('starts the focus on today, clamped into the bounds, when nothing is chosen', () => {
    renderCalendar({ value: null, days: { today: '2026-09-07', min: '2026-09-10' } });

    expect(dayNamed('10 вересня 2026').getAttribute('tabindex')).toBe('0');
    expect(screen.getByText(COPY.none).parentElement?.textContent).toBe(
      `${COPY.selected} ${COPY.none}`,
    );
    expect(screen.queryByText(COPY.marked)).toBeNull();
  });
});

describe('Calendar keyboard', () => {
  it.each([
    { keys: '{ArrowRight}', focused: '4 вересня 2026', month: 'вересень 2026' },
    { keys: '{ArrowLeft}', focused: '2 вересня 2026', month: 'вересень 2026' },
    { keys: '{ArrowDown}', focused: '10 вересня 2026', month: 'вересень 2026' },
    { keys: '{ArrowUp}', focused: '27 серпня 2026', month: 'серпень 2026' },
    { keys: '{Home}', focused: '31 серпня 2026', month: 'серпень 2026' },
    { keys: '{End}', focused: '6 вересня 2026', month: 'вересень 2026' },
    { keys: '{PageUp}', focused: '3 серпня 2026', month: 'серпень 2026' },
    { keys: '{PageDown}', focused: '3 жовтня 2026', month: 'жовтень 2026' },
    { keys: '{Shift>}{PageUp}{/Shift}', focused: '3 вересня 2025', month: 'вересень 2025' },
    { keys: '{Shift>}{PageDown}{/Shift}', focused: '3 вересня 2027', month: 'вересень 2027' },
  ])('$keys from 3 September focuses $focused in $month', async ({ keys, focused, month }) => {
    const { user, picked } = renderCalendar();

    await tabToGrid(user);
    await user.keyboard(keys);

    expect(document.activeElement).toBe(dayNamed(focused));
    expect(document.activeElement?.getAttribute('tabindex')).toBe('0');
    expect(shownMonth()).toBe(month);
    expect(picked).toEqual([]);
  });

  it('ArrowRight on the last day turns the month and Enter picks the new day', async () => {
    const { user, picked } = renderCalendar({ value: '2026-09-30' });

    await tabToGrid(user);
    await user.keyboard('{ArrowRight}');

    expect(shownMonth()).toBe('жовтень 2026');
    expect(document.activeElement).toBe(dayNamed('1 жовтня 2026'));
    await user.keyboard('{Enter}');
    expect(picked).toEqual(['2026-10-01']);
  });

  it('the month arrows turn the view and move the grid tab stop with it', async () => {
    const { user } = renderCalendar();

    await user.click(screen.getByRole('button', { name: COPY.nextMonth }));
    expect(shownMonth()).toBe('жовтень 2026');
    expect(dayNamed('3 жовтня 2026').getAttribute('tabindex')).toBe('0');
    await user.click(screen.getByRole('button', { name: COPY.previousMonth }));
    await user.click(screen.getByRole('button', { name: COPY.previousMonth }));
    expect(shownMonth()).toBe('серпень 2026');
  });
});

describe('Calendar month and year panels', () => {
  it('the month panel picks a month and gives focus back to the day grid', async () => {
    const { user, picked } = renderCalendar();
    const toggle = screen.getByRole('button', { name: 'вересень', expanded: false });

    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const months = within(screen.getByRole('group', { name: COPY.monthPanel }));
    expect(months.getAllByRole('button').map((button) => button.textContent)).toEqual([
      ...COPY.monthsShort,
    ]);
    expect(months.getByRole('button', { name: 'вересень' }).getAttribute('aria-current')).toBe(
      'true',
    );
    await user.click(months.getByRole('button', { name: 'грудень' }));

    expect(shownMonth()).toBe('грудень 2026');
    expect(document.activeElement).toBe(dayNamed('3 грудня 2026'));
    expect(picked).toEqual([]);
  });

  it('the year panel shows the decade with one muted year each side, then hands over to months', async () => {
    const { user } = renderCalendar();

    await user.click(screen.getByRole('button', { name: '2026', expanded: false }));
    expect(screen.getByText(COPY.decade(2020))).toBeDefined();
    const years = () => within(screen.getByRole('group', { name: COPY.yearPanel }));
    const labels = years()
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(labels).toEqual(Array.from({ length: 12 }, (_, index) => String(2019 + index)));
    expect(years().getByRole('button', { name: '2019' }).classList.contains('text-ink-3')).toBe(
      true,
    );
    expect(years().getByRole('button', { name: '2030' }).classList.contains('text-ink-3')).toBe(
      true,
    );
    expect(years().getByRole('button', { name: '2029' }).classList.contains('text-ink-3')).toBe(
      false,
    );

    await user.click(screen.getByRole('button', { name: COPY.nextDecade }));
    await user.click(years().getByRole('button', { name: '2031' }));
    const months = within(screen.getByRole('group', { name: COPY.monthPanel }));
    expect(document.activeElement).toBe(months.getByRole('button', { name: 'вересень' }));
    await user.click(months.getByRole('button', { name: 'травень' }));

    expect(shownMonth()).toBe('травень 2031');
    expect(document.activeElement).toBe(dayNamed('3 травня 2031'));
  });

  it('has no axe violations on the year panel', async () => {
    const { user } = renderCalendar();

    await user.click(screen.getByRole('button', { name: '2026', expanded: false }));

    expect(await axeViolations()).toEqual([]);
  });
});

describe('Calendar footer', () => {
  it('shows Готово only when done is passed and calls onDone', async () => {
    const closed: string[] = [];
    const { user } = renderCalendar({ done: { onDone: () => closed.push('done') } });

    await user.click(screen.getByRole('button', { name: COPY.done }));

    expect(closed).toEqual(['done']);
  });

  it('leaves Готово out of a standalone calendar', () => {
    renderCalendar();

    expect(screen.queryByRole('button', { name: COPY.done })).toBeNull();
    expect(screen.getByRole('button', { name: COPY.today })).toBeDefined();
  });
});
