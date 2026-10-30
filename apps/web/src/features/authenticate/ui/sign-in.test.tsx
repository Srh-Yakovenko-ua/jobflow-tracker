import { act, screen } from '@testing-library/react';
import { HttpResponse } from 'msw/http';
import { delay } from 'msw/utils/delay';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_CLIENT_LIMITS } from '@/shared/api';
import {
  CREDENTIALS,
  expectSignedIn,
  findAlertText,
  invalidFields,
  renderAuthForm,
  resetSignIn,
} from '@/test/auth-form';
import { replace } from '@/test/navigation';
import { server } from '@/test/server';
import { AUTH_RESPONSE, authErrorRoute, authRoute } from '@/test/session-fixtures';

vi.mock('next/navigation', () => import('@/test/navigation'));

const LOGIN = { path: '/auth/login' } as const;

const UNAVAILABLE = 'Сервер не відповідаєЦе збій на нашому боці. Спробуй ще раз за хвилину.';

describe('sign in', () => {
  afterEach(() => {
    resetSignIn();
    vi.useRealTimers();
  });

  it('the demo user signs in: the token serves the next request and the board opens', async () => {
    server.use(authRoute(LOGIN));
    const form = renderAuthForm({ mode: 'login' });

    await form.fillAndSubmit(CREDENTIALS);

    await expectSignedIn();
  });

  it('401 shows the generic message, marks no field and raises no save toast', async () => {
    server.use(
      authErrorRoute({
        ...LOGIN,
        error: {
          status: 401,
          type: 'unauthorized',
          title: 'Unauthorized',
          detail: 'Invalid email or password',
        },
      }),
    );
    const form = renderAuthForm({ mode: 'login' });

    await form.fillAndSubmit(CREDENTIALS);

    expect(await findAlertText()).toBe(
      'Невірна пошта або парольПеревір обидва поля й спробуй ще раз.',
    );
    expect(invalidFields()).toEqual([]);
    expect(toast.getToasts()).toEqual([]);
    expect(replace).not.toHaveBeenCalled();
  });

  it('an empty password shows Введи пароль on the field and sends no request', async () => {
    const onLogin = vi.fn(() => HttpResponse.json(AUTH_RESPONSE));
    server.use(authRoute({ ...LOGIN, reply: onLogin }));
    const form = renderAuthForm({ mode: 'login' });

    await form.fillAndSubmit({ email: CREDENTIALS.email });

    expect(await screen.findByText('Введи пароль')).toBeDefined();
    expect(invalidFields()).toEqual([form.password]);
    expect(document.activeElement).toBe(form.password);
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('keyboard only: Tab walks both tabs, email, password, its toggle and submit, Enter in the password signs in', async () => {
    server.use(authRoute(LOGIN));
    const { user, email, password, submit } = renderAuthForm({ mode: 'login' });
    const order = [
      screen.getByRole('link', { name: 'Створити акаунт' }),
      screen.getByRole('link', { name: 'Увійти' }),
      email,
      password,
      screen.getByRole('button', { name: 'Показати пароль' }),
      submit,
    ];
    const visited: number[] = [];

    for (const typed of ['', '', CREDENTIALS.email, CREDENTIALS.password, '', '']) {
      await user.tab();
      visited.push(order.findIndex((element) => element === document.activeElement));
      if (typed !== '') await user.keyboard(typed);
    }
    expect(visited).toEqual([0, 1, 2, 3, 4, 5]);
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    await user.keyboard('{Enter}');

    await expectSignedIn();
  });

  it('a refused connection shows that the server is not answering and keeps submit enabled', async () => {
    server.use(authRoute({ ...LOGIN, reply: () => HttpResponse.error() }));
    const form = renderAuthForm({ mode: 'login' });

    await form.fillAndSubmit(CREDENTIALS);

    expect(await findAlertText()).toBe(UNAVAILABLE);
    expect(form.submit).toHaveProperty('disabled', false);
  });

  it('a 503 shows that the server is not answering, keeps submit enabled and raises no save toast', async () => {
    server.use(
      authErrorRoute({
        ...LOGIN,
        error: { status: 503, type: 'service_unavailable', title: 'Service unavailable' },
      }),
    );
    const form = renderAuthForm({ mode: 'login' });

    await form.fillAndSubmit(CREDENTIALS);

    expect(await findAlertText()).toBe(UNAVAILABLE);
    expect(form.submit).toHaveProperty('disabled', false);
    expect(toast.getToasts()).toEqual([]);
  });

  it('an API that never answers shows the same message once the client limit runs out', async () => {
    server.use(authRoute({ ...LOGIN, reply: () => delay('infinite') }));
    const form = renderAuthForm({ mode: 'login' });
    await form.fill(CREDENTIALS);

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    await form.user.click(form.submit);
    expect(screen.queryByRole('alert')).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(API_CLIENT_LIMITS.requestTimeoutMs));

    expect(await findAlertText()).toBe(UNAVAILABLE);
    expect(form.submit).toHaveProperty('disabled', false);
  });
});
