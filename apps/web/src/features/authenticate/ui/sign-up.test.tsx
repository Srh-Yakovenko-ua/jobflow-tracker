import { screen } from '@testing-library/react';
import { HttpResponse } from 'msw/http';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, recordSentRequests } from '@/test/api-handlers';
import {
  CREDENTIALS,
  expectSignedIn,
  findAlertText,
  invalidFields,
  renderAuthForm,
  resetSignIn,
} from '@/test/auth-form';
import { server } from '@/test/server';
import { AUTH_RESPONSE, authErrorRoute, authRoute } from '@/test/session-fixtures';

vi.mock('next/navigation', () => import('@/test/navigation'));

const REGISTER = { path: '/auth/register' } as const;

const VALIDATION_ERROR = {
  status: 422,
  type: 'validation_error',
  title: 'Invalid request',
} as const;

const REGISTER_URL = apiUrl(REGISTER.path);

const LENGTH_COPY = 'Пароль має містити від 10 до 128 символів';

const UNAVAILABLE = 'Сервер не відповідаєЦе збій на нашому боці. Спробуй ще раз за хвилину.';

describe('sign up', () => {
  afterEach(() => {
    resetSignIn();
    vi.restoreAllMocks();
  });

  it('registration sends exactly the email and password, keeps the token and opens the board', async () => {
    const sentRequests = recordSentRequests();
    server.use(authRoute(REGISTER));
    const form = renderAuthForm({ mode: 'register' });

    await form.fillAndSubmit(CREDENTIALS);

    await expectSignedIn();
    expect(sentRequests().filter(({ url }) => url === REGISTER_URL)).toEqual([
      {
        url: REGISTER_URL,
        method: 'POST',
        credentials: 'include',
        body: { email: 'andrii@example.com', password: 'jobflow-demo' },
      },
    ]);
  });

  it('a 9-character password shows the length rule in Ukrainian and sends no request', async () => {
    const onRegister = vi.fn(() => HttpResponse.json(AUTH_RESPONSE));
    server.use(authRoute({ ...REGISTER, reply: onRegister }));
    const form = renderAuthForm({ mode: 'register' });

    await form.fillAndSubmit({ email: CREDENTIALS.email, password: 'a'.repeat(9) });

    expect(await screen.findByText(LENGTH_COPY)).toBeDefined();
    expect(invalidFields()).toEqual([form.password]);
    expect(onRegister).not.toHaveBeenCalled();
  });

  it('409 puts the taken copy on the email field, focuses it and raises no banner or toast', async () => {
    server.use(
      authErrorRoute({
        ...REGISTER,
        error: {
          status: 409,
          type: 'conflict',
          title: 'Conflict',
          detail: 'Email is already registered',
        },
      }),
    );
    const form = renderAuthForm({ mode: 'register' });

    await form.fillAndSubmit(CREDENTIALS);

    expect(
      await screen.findByText('Ця пошта вже зареєстрована. Увійди на вкладці «Увійти»'),
    ).toBeDefined();
    expect(invalidFields()).toEqual([form.email]);
    expect(document.activeElement).toBe(form.email);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(toast.getToasts()).toEqual([]);
  });

  it('422 field errors show the Ukrainian copy instead of the server English', async () => {
    server.use(
      authErrorRoute({
        ...REGISTER,
        error: {
          ...VALIDATION_ERROR,
          errors: [
            { path: 'email', message: 'Invalid email address' },
            { path: 'password', message: 'Too big: expected string to have <=128 characters' },
          ],
        },
      }),
    );
    const form = renderAuthForm({ mode: 'register' });

    await form.fillAndSubmit(CREDENTIALS);

    expect(await screen.findByText(LENGTH_COPY)).toBeDefined();
    expect(screen.getByText('Вкажи пошту у форматі name@example.com')).toBeDefined();
    expect(screen.queryByText('Invalid email address')).toBeNull();
    expect(invalidFields()).toEqual([form.email, form.password]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a 422 that names no credential field shows that the server is not answering and marks no field', async () => {
    server.use(
      authErrorRoute({
        ...REGISTER,
        error: {
          ...VALIDATION_ERROR,
          errors: [
            { path: 'displayName', message: 'Too big: expected string to have <=80 characters' },
          ],
        },
      }),
    );
    const form = renderAuthForm({ mode: 'register' });

    await form.fillAndSubmit(CREDENTIALS);

    expect(await findAlertText()).toBe(UNAVAILABLE);
    expect(invalidFields()).toEqual([]);
    expect(form.submit).toHaveProperty('disabled', false);
  });
});
