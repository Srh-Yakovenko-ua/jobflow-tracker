import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { describe, expect, it } from 'vitest';

import { apiUrl, errorReply, validationReply } from '@/test/api-handlers';
import { heldReply, type MoveRouteOptions } from '@/test/board-fixtures';
import { doubleClickWhileHeld } from '@/test/double-click-while-held';
import { latch } from '@/test/latch';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { ChangePasswordForm } from './change-password-form';

const PASSWORDS = { currentPassword: 'old-secret-1', newPassword: 'brand-new-secret-2' };

const CHANGED = 'Пароль змінено. На інших пристроях треба увійти знову.';

const SUBMIT = 'Змінити пароль';

const SAVE_FAILED_TOAST = 'Це збій на нашому боці, збережені дані на місці. Спробуй ще раз.';

const FIELDS_BANNER = 'Перевір поля й спробуй ще раз.';

function renderForm(control: MoveRouteOptions = {}) {
  const sent: unknown[] = [];
  server.use(
    http.post(apiUrl('/auth/change-password'), async (info) => {
      sent.push(await info.request.json());
      return heldReply({
        ...control,
        info,
        fallback: () => new HttpResponse(null, { status: 204 }),
      });
    }),
  );
  const user = renderInApp(<ChangePasswordForm />);
  const fields = {
    current: screen.getByLabelText('Поточний пароль'),
    next: screen.getByLabelText('Новий пароль'),
  };
  const fill = async (passwords: typeof PASSWORDS) => {
    await user.type(fields.current, passwords.currentPassword);
    await user.type(fields.next, passwords.newPassword);
  };
  const submit = async (passwords: typeof PASSWORDS) => {
    await fill(passwords);
    await user.click(screen.getByRole('button', { name: SUBMIT }));
  };
  return { sent, fields, user, fill, submit };
}

describe('ChangePasswordForm', () => {
  it('posts both passwords from a method=post form, then clears it and says the password changed', async () => {
    const { sent, fields, submit } = renderForm();

    expect(screen.getByRole('form', { name: 'Зміна пароля' }).getAttribute('method')).toBe('post');
    await submit(PASSWORDS);

    expect(await screen.findByText(CHANGED)).toBeDefined();
    expect(sent).toEqual([PASSWORDS]);
    expect(fields.current).toHaveProperty('value', '');
    expect(fields.next).toHaveProperty('value', '');
  });

  it('a double click while the change is on its way sends one request and keeps Змінити пароль disabled', async () => {
    const held = latch();
    const { sent, user, fill } = renderForm({ latch: held });
    await fill(PASSWORDS);

    await doubleClickWhileHeld({ user, held, click: SUBMIT, sent, disabledWhileHeld: [SUBMIT] });

    expect(await screen.findByText(CHANGED)).toBeDefined();
    expect(sent).toEqual([PASSWORDS]);
  });

  it('a wrong current password shows under that field and the change is not confirmed', async () => {
    const { fields, submit } = renderForm({
      reply: () =>
        validationReply([{ path: 'currentPassword', message: 'Current password is wrong' }]),
    });

    await submit(PASSWORDS);

    expect(await screen.findByText('Поточний пароль не підходить')).toBeDefined();
    expect(fields.current.getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByText(/Пароль змінено/)).toBeNull();
  });

  it('a 422 that names no form field shows the form error banner and the change is not confirmed', async () => {
    const { submit } = renderForm({
      reply: () => validationReply([{ path: 'passwords', message: 'Passwords must differ' }]),
    });

    await submit(PASSWORDS);

    expect(await screen.findByText('Перевір поля й спробуй ще раз.')).toBeDefined();
    expect(screen.queryByText(/Пароль змінено/)).toBeNull();
  });

  it('a change the server fails shows the save failed toast and the change is not confirmed', async () => {
    const { fields, submit } = renderForm({
      reply: () => errorReply({ status: 500, type: 'internal_error' }),
    });

    await submit(PASSWORDS);

    expect(await screen.findByText(SAVE_FAILED_TOAST)).toBeDefined();
    expect(screen.queryByText(FIELDS_BANNER)).toBeNull();
    expect(screen.queryByText(/Пароль змінено/)).toBeNull();
    expect(fields.current).toHaveProperty('value', PASSWORDS.currentPassword);
    expect(fields.next).toHaveProperty('value', PASSWORDS.newPassword);
  });

  it('a new password under ten characters is refused before anything is sent', async () => {
    const { sent, submit } = renderForm();

    await submit({ ...PASSWORDS, newPassword: 'short' });

    expect(await screen.findByText('Пароль має містити від 10 до 128 символів')).toBeDefined();
    await waitFor(() => {
      expect(sent).toEqual([]);
    });
  });
});
