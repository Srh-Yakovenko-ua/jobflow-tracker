import { screen, waitFor, within } from '@testing-library/react';
import type { HttpResponseResolver } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { userStorageKeyOf } from '@/entities/user';
import { deleteAccountRoute } from '@/test/account-fixtures';
import { errorReply, validationReply } from '@/test/api-handlers';
import { replace } from '@/test/navigation';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { ME_RESPONSE, meRoute } from '@/test/session-fixtures';

import { DeleteAccountDialog } from './delete-account-dialog';

vi.mock('next/navigation', () => import('@/test/navigation'));

const DIALOG = { name: 'Видалити акаунт назавжди?' } as const;

const CONFIRM = { name: 'Видалити акаунт' } as const;

const RECENT_KEY = userStorageKeyOf({ name: 'recent-applications', userId: ME_RESPONSE.user.id });

async function openDialog(reply?: HttpResponseResolver) {
  const route = deleteAccountRoute(reply);
  server.use(meRoute(), route.handler);
  const user = renderInApp(<DeleteAccountDialog exportOffer={<p>export offer slot</p>} />);
  await user.click(screen.getByRole('button', CONFIRM));
  const dialog = await screen.findByRole('alertdialog', DIALOG);
  return { user, dialog, sent: route.sent };
}

afterEach(() => {
  replace.mockClear();
  localStorage.clear();
});

describe('DeleteAccountDialog', () => {
  it('warns what goes, offers the export first and hints what OAuth accounts type', async () => {
    const { dialog } = await openDialog();

    expect(dialog.textContent).toContain(
      'Зникнуть усі вакансії, історія етапів, контакти, нотатки, резюме з файлами, нагадування й AI-результати. Відновити їх не вийде.',
    );
    expect(dialog.textContent).toContain('Спершу збережи архів зі своїми даними.');
    expect(screen.getByText('export offer slot')).toBeDefined();
    expect(
      screen.getByLabelText('Пароль', { selector: 'input' }).getAttribute('aria-describedby'),
    ).not.toBeNull();
    expect(dialog.textContent).toContain(
      'Входиш через Google чи GitHub? Введи пошту свого акаунта.',
    );
  });

  it('an empty password asks for it and sends nothing', async () => {
    const { user, dialog, sent } = await openDialog();

    await user.click(within(dialog).getByRole('button', CONFIRM));

    expect(await screen.findByText('Введи пароль')).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('a wrong password shows on the field and keeps the dialog open', async () => {
    const { user, sent } = await openDialog(() =>
      validationReply([{ path: 'password', message: 'Password is wrong' }]),
    );

    await user.type(screen.getByLabelText('Пароль', { selector: 'input' }), 'not-mine{Enter}');

    expect(
      await screen.findByText(
        'Не підходить. Для входу через Google чи GitHub введи пошту акаунта.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('alertdialog', DIALOG)).toBeDefined();
    expect(sent).toEqual([{ password: 'not-mine' }]);
    expect(replace).not.toHaveBeenCalled();
  });

  it('a 204 ends the session, forgets the recent cards and replaces the page with /login', async () => {
    localStorage.setItem(RECENT_KEY, '[]');
    const { user, dialog, sent } = await openDialog();

    await user.type(screen.getByLabelText('Пароль', { selector: 'input' }), 'correct horse');
    await user.click(within(dialog).getByRole('button', CONFIRM));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
    expect(sent).toEqual([{ password: 'correct horse' }]);
    expect(localStorage.getItem(RECENT_KEY)).toBeNull();
  });

  it('storage that does not answer says the account stays and keeps the dialog open', async () => {
    const { user } = await openDialog(() =>
      errorReply({ status: 503, type: 'service_unavailable' }),
    );

    await user.type(screen.getByLabelText('Пароль', { selector: 'input' }), 'correct horse{Enter}');

    expect(await screen.findByText('Не вдалося видалити акаунт')).toBeDefined();
    expect(screen.getByRole('alertdialog', DIALOG)).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
  });
});
