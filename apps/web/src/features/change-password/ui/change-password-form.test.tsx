import { screen, waitFor } from '@testing-library/react';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';
import { describe, expect, it } from 'vitest';

import { apiUrl, errorReply } from '@/test/api-handlers';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { ChangePasswordForm } from './change-password-form';

const PASSWORDS = { currentPassword: 'old-secret-1', newPassword: 'brand-new-secret-2' };

function renderForm(reply: HttpResponseResolver = () => new HttpResponse(null, { status: 204 })) {
  const sent: unknown[] = [];
  server.use(
    http.post(apiUrl('/auth/change-password'), async (info) => {
      sent.push(await info.request.json());
      return reply(info);
    }),
  );
  const user = renderInApp(<ChangePasswordForm />);
  const fields = {
    current: screen.getByLabelText('Поточний пароль'),
    next: screen.getByLabelText('Новий пароль'),
  };
  const submit = async (passwords: typeof PASSWORDS) => {
    await user.type(fields.current, passwords.currentPassword);
    await user.type(fields.next, passwords.newPassword);
    await user.click(screen.getByRole('button', { name: 'Змінити пароль' }));
  };
  return { sent, fields, submit };
}

describe('ChangePasswordForm', () => {
  it('posts both passwords from a method=post form, then clears it and says the password changed', async () => {
    const { sent, fields, submit } = renderForm();

    expect(screen.getByRole('form', { name: 'Зміна пароля' }).getAttribute('method')).toBe('post');
    await submit(PASSWORDS);

    expect(
      await screen.findByText('Пароль змінено. На інших пристроях треба увійти знову.'),
    ).toBeDefined();
    expect(sent).toEqual([PASSWORDS]);
    expect(fields.current).toHaveProperty('value', '');
    expect(fields.next).toHaveProperty('value', '');
  });

  it('a wrong current password shows under that field and the change is not confirmed', async () => {
    const { fields, submit } = renderForm(() =>
      errorReply({
        status: 422,
        type: 'validation_error',
        errors: [{ path: 'currentPassword', message: 'Current password is wrong' }],
      }),
    );

    await submit(PASSWORDS);

    expect(await screen.findByText('Поточний пароль не підходить')).toBeDefined();
    expect(fields.current.getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByText(/Пароль змінено/)).toBeNull();
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
