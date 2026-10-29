import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { Field } from './field';
import { NumberInput } from './number-input';

const COPY = uk.devUi.fields.threshold;

function Threshold() {
  const [days, setDays] = useState(6);
  return (
    <Field label={COPY.label}>
      <NumberInput
        value={days}
        onValueChange={setDays}
        range={{ min: 1, max: 7 }}
        unit={COPY.unit}
      />
    </Field>
  );
}

describe('NumberInput', () => {
  it('ArrowUp steps the value and stops at the maximum with the plus button disabled', async () => {
    const user = userEvent.setup();
    render(<Threshold />);
    const input = screen.getByRole('spinbutton', { name: COPY.label });

    await user.click(input);
    await user.keyboard('{ArrowUp}{ArrowUp}');

    expect(input.getAttribute('aria-valuenow')).toBe('7');
    expect(input.getAttribute('aria-valuetext')).toBe('7 днів');
    expect(screen.getByRole('button', { name: uk.ui.increase })).toHaveProperty('disabled', true);
  });

  it('a typed value past the range is clamped when the field loses focus', async () => {
    const user = userEvent.setup();
    render(<Threshold />);
    const input = screen.getByRole('spinbutton', { name: COPY.label });

    await user.tripleClick(input);
    await user.keyboard('42');
    await user.tab();

    expect(input).toHaveProperty('value', '7');
  });

  it('minus and plus anchor their 44 px hit areas outward so they meet in the gap', () => {
    render(<Threshold />);

    const minus = screen.getByRole('button', { name: uk.ui.decrease }).className;
    const plus = screen.getByRole('button', { name: uk.ui.increase }).className;
    expect(minus).toContain('after:left-auto after:right-[-3px]');
    expect(minus).not.toContain('after:left-[-3px]');
    expect(plus).toContain('after:left-[-3px]');
  });

  it('the minus button steps down from the pointer', async () => {
    const user = userEvent.setup();
    render(<Threshold />);

    await user.click(screen.getByRole('button', { name: uk.ui.decrease }));

    expect(screen.getByRole('spinbutton', { name: COPY.label }).getAttribute('aria-valuenow')).toBe(
      '5',
    );
  });
});
