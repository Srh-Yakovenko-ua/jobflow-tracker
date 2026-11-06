import { render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { type ReactNode, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { DateField } from './date-field';
import { Dialog, DialogContent, DialogTrigger } from './dialog';
import { Field } from './field';

const COPY = uk.calendar;

const MODAL = uk.devUi.feedback;

const TODAY = '2026-09-07';

function DateFieldHarness({ initial }: Readonly<{ initial: string | null }>) {
  const [value, setValue] = useState(initial);
  return (
    <Field label={COPY.label}>
      <DateField selection={{ value, onSelect: setValue }} days={{ today: TODAY }} />
    </Field>
  );
}

function renderDateField(initial: string | null, wrap = (field: ReactNode) => field) {
  render(<main>{wrap(<DateFieldHarness initial={initial} />)}</main>);
  return userEvent.setup();
}

function trigger(): HTMLElement {
  return screen.getByRole('button', { name: (name) => name.startsWith(COPY.label) });
}

function focusedDay(): string | null | undefined {
  return document.activeElement?.getAttribute('aria-label');
}

describe('DateField', () => {
  it('names the trigger by its label and date, and opening focuses the chosen day', async () => {
    const user = renderDateField('2026-09-03');

    expect(trigger().textContent).toBe('03.09.2026');
    expect(trigger().getAttribute('aria-haspopup')).toBe('dialog');
    await user.click(trigger());

    expect(screen.getByRole('dialog', { name: COPY.label })).toBeDefined();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(focusedDay()).toBe('четвер, 3 вересня 2026 р.');
    expect(document.activeElement?.getAttribute('aria-selected')).toBe('true');
  });

  it('with nothing chosen shows the placeholder and opening focuses today', async () => {
    const user = renderDateField(null);

    expect(trigger().textContent).toBe(COPY.placeholder);
    await user.click(trigger());

    expect(focusedDay()).toBe('понеділок, 7 вересня 2026 р.');
  });

  it('picking a day updates the field and keeps the popover open', async () => {
    const user = renderDateField('2026-09-03');

    await user.click(trigger());
    await user.click(screen.getByRole('gridcell', { name: 'пʼятниця, 11 вересня 2026 р.' }));

    expect(trigger().textContent).toBe('11.09.2026');
    expect(screen.getByRole('dialog', { name: COPY.label })).toBeDefined();
  });

  it.each([
    { name: 'Escape', close: (user: UserEvent) => user.keyboard('{Escape}') },
    {
      name: 'Готово',
      close: (user: UserEvent) => user.click(screen.getByRole('button', { name: COPY.done })),
    },
  ])('$name closes the popover and gives focus back to the trigger', async ({ close }) => {
    const user = renderDateField('2026-09-03');

    await user.click(trigger());
    await close(user);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('inside a dialog, Escape closes only the popover', async () => {
    const user = renderDateField('2026-09-03', (field) => (
      <Dialog>
        <DialogTrigger>{MODAL.openModal}</DialogTrigger>
        <DialogContent header={{ title: MODAL.modal.title }}>{field}</DialogContent>
      </Dialog>
    ));

    await user.click(screen.getByRole('button', { name: MODAL.openModal }));
    await user.click(trigger());
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: COPY.label })).toBeNull();
    expect(screen.getByRole('dialog', { name: MODAL.modal.title })).toBeDefined();
    expect(document.activeElement).toBe(trigger());
  });
});
