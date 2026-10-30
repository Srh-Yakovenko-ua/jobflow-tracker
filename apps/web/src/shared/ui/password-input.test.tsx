import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { Field } from './field';
import { PasswordInput } from './password-input';

const LABEL = uk.auth.password.label;

function renderPasswordField() {
  const user = userEvent.setup();
  render(
    <Field label={LABEL}>
      <PasswordInput autoComplete="current-password" />
    </Field>,
  );
  return {
    user,
    input: screen.getByLabelText(LABEL),
    toggle: screen.getByRole('button', { name: uk.ui.showPassword }),
  };
}

function lookOf({ input, toggle }: { input: HTMLElement; toggle: HTMLElement }) {
  return {
    type: input.getAttribute('type'),
    pressed: toggle.getAttribute('aria-pressed'),
    name: toggle.getAttribute('aria-label'),
  };
}

const HIDDEN = { type: 'password', pressed: 'false', name: 'Показати пароль' };
const SHOWN = { type: 'text', pressed: 'true', name: 'Показати пароль' };

describe('PasswordInput', () => {
  it('a click shows the password as text, a second click hides it, the label never changes', async () => {
    const field = renderPasswordField();
    const looks = [lookOf(field)];

    await field.user.click(field.toggle);
    looks.push(lookOf(field));
    await field.user.click(field.toggle);
    looks.push(lookOf(field));

    expect(looks).toEqual([HIDDEN, SHOWN, HIDDEN]);
  });

  it('Tab reaches the toggle after the field, Enter shows and Space hides the password', async () => {
    const field = renderPasswordField();

    await field.user.tab();
    expect(document.activeElement).toBe(field.input);
    await field.user.tab();
    expect(document.activeElement).toBe(field.toggle);
    await field.user.keyboard('{Enter}');
    const afterEnter = lookOf(field);
    await field.user.keyboard(' ');

    expect([afterEnter, lookOf(field)]).toEqual([SHOWN, HIDDEN]);
  });
});
