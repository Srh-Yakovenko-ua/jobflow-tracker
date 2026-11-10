import { bookmarkletHref } from '@jobflow/bookmarklet';
import { focusManager, useMutationState } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { HttpResponse, type HttpResponseResolver } from 'msw';
import { delay } from 'msw/utils/delay';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_CLIENT_LIMITS } from '@/shared/api';
import { errorReply, OUTAGES } from '@/test/api-handlers';
import { axeViolations } from '@/test/axe';
import {
  captureTokenRoutes,
  type CaptureTokenRoutesOptions,
  UNUSED_TOKEN,
  USED_TOKEN,
} from '@/test/capture-token-fixtures';
import { advanceBy, advancePastQueryRetries, fakeTimeouts } from '@/test/fake-timeouts';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import { renderInApp, renderViewInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import { captureTokenKeys } from '../model/keys';
import { InstallBookmarklet } from './install-bookmarklet';

type ConfirmCopy = Readonly<{ trigger: string; dialog: string; press: string }>;

const LIST_KEY = captureTokenKeys.list();

const CREATE = { name: 'Створити кнопку' } as const;

const LINK = { name: 'JobFlow' } as const;

const LINK_BEHIND_DIALOG = { ...LINK, hidden: true } as const;

const CANCEL = { name: 'Скасувати' } as const;

const SHOWN_ONCE = /Кнопку видно лише одразу після створення/;

const HELD_MUTATION_DATA = 'mutation data held in the cache';

const REGENERATE: ConfirmCopy = {
  trigger: 'Нова кнопка',
  dialog: 'Створити нову кнопку?',
  press: 'Створити нову',
};

const REVOKE: ConfirmCopy = {
  trigger: 'Вимкнути букмарклет',
  dialog: 'Вимкнути букмарклет?',
  press: 'Вимкнути',
};

const USED_AT_IN_KYIV = '10.11, 01:15';

const NEVER_USED = 'ще не спрацьовував';

const CREATE_FAILED = 'Не вдалося створити кнопку';

const REVOKE_FAILED = 'Не вдалося вимкнути букмарклет';

const SERVER_ERROR = () => errorReply({ status: 500, type: 'internal_error' });

const LIST_OUTAGE_SHOWS = {
  error: () => screen.getByRole('alert'),
  pending: () => screen.getByText('Завантаження…'),
} as const;

const CREATE_OUTAGE_SHOWS = {
  error: () => screen.findByText(CREATE_FAILED),
  pending: () => screen.findByRole('button', { ...CREATE, busy: true }),
} as const;

const REGENERATE_OUTAGE_SHOWS = {
  error: () => screen.findByText(CREATE_FAILED),
  pending: () => screen.findByRole('button', { name: REGENERATE.press, busy: true }),
} as const;

function HeldMutationData() {
  const held = useMutationState({ select: (mutation) => mutation.state.data });
  return <output aria-label={HELD_MUTATION_DATA}>{JSON.stringify(held)}</output>;
}

function hrefOf(token: string): string {
  return bookmarkletHref({
    token,
    apiUrl: 'http://localhost:4000',
    webUrl: window.location.origin,
  });
}

function renderSection(options?: CaptureTokenRoutesOptions) {
  const routes = captureTokenRoutes(options);
  server.use(meRoute(), ...routes.handlers);
  const user = renderInApp(
    <main>
      <InstallBookmarklet />
      <QueryProbe queryKey={LIST_KEY} />
    </main>,
  );
  return { user, ...routes };
}

async function renderWithButton(options?: CaptureTokenRoutesOptions) {
  const view = renderSection(options);
  await view.user.click(await screen.findByRole('button', CREATE));
  const link = await screen.findByRole('link', LINK);
  return { ...view, link };
}

async function openConfirm(user: UserEvent, copy: ConfirmCopy) {
  await user.click(await screen.findByRole('button', { name: copy.trigger }));
  return screen.findByRole('dialog', { name: copy.dialog });
}

async function cancelConfirm(user: UserEvent, copy: ConfirmCopy) {
  const dialog = await openConfirm(user, copy);
  const warning = dialog.textContent;
  await user.click(screen.getByRole('button', CANCEL));
  return { warning, open: screen.queryByRole('dialog') };
}

async function confirm(user: UserEvent, copy: ConfirmCopy) {
  await openConfirm(user, copy);
  await user.click(screen.getByRole('button', { name: copy.press }));
}

function returnToTab() {
  focusManager.setFocused(false);
  focusManager.setFocused(true);
}

function createButtonOnceListEmpties({ store }: Pick<ReturnType<typeof renderSection>, 'store'>) {
  store.items = [];
  returnToTab();
  return screen.findByRole('button', CREATE);
}

afterEach(() => {
  vi.useRealTimers();
  toast.dismiss();
  focusManager.setFocused(undefined);
});

describe('InstallBookmarklet', () => {
  it('opens without creating a capture token or taking focus, and offers the create button', async () => {
    const { sent } = renderSection();

    expect(await screen.findByRole('button', CREATE)).toBeDefined();
    expect(document.activeElement).toBe(document.body);
    expect(screen.queryByRole('link', LINK)).toBeNull();
    expect(sent).toEqual([]);
  });

  it.each(OUTAGES)(
    'when the capture token list $name it says so and offers no create button',
    async ({ reply, settled }) => {
      renderSection({ replies: { list: reply } });

      await waitForQuery({ queryKey: LIST_KEY, status: settled });

      expect(LIST_OUTAGE_SHOWS[settled]()).toBeDefined();
      expect(screen.queryByRole('button', CREATE)).toBeNull();
    },
  );

  it('a capture token list that never answers ends in the load failed alert once the request limit passes', async () => {
    fakeTimeouts();
    renderSection({ replies: { list: () => delay('infinite') } });

    await advancePastQueryRetries();

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Спробувати ще раз' })).toBeDefined();
  });

  it('a retry after a failed list load brings the create button', async () => {
    const failures = [SERVER_ERROR, SERVER_ERROR];
    const { user } = renderSection({
      replies: { list: () => failures.shift()?.() ?? HttpResponse.json({ items: [] }) },
    });
    await waitForQuery({ queryKey: LIST_KEY, status: 'error' });

    await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));

    expect(await screen.findByRole('button', CREATE)).toBeDefined();
  });

  it('Створити кнопку sends one POST and shows a draggable link holding the bookmarklet URL', async () => {
    const { link, sent } = await renderWithButton();
    const href = link.getAttribute('href');

    expect(href).toBe(hrefOf('capture-token-one'));
    expect(href).toMatch(/^javascript:/);
    expect(href).toContain('"token":"capture-token-one"');
    expect(href).toContain('"apiUrl":"http://localhost:4000"');
    expect(href).not.toContain('React has blocked');
    expect(link.getAttribute('draggable')).toBe('true');
    expect(sent).toEqual(['POST']);
    expect(await screen.findByText('Кнопка готова')).toBeDefined();
    expect(screen.queryByRole('button', CREATE)).toBeNull();
  });

  it('a click on the link runs nothing here and says to drag it', async () => {
    const { link } = await renderWithButton();

    const ranDefault = fireEvent.click(link);

    expect(ranDefault).toBe(false);
    expect(
      await screen.findByText('Не клікай тут: перетягни кнопку на панель закладок'),
    ).toBeDefined();
  });

  it('while the link is dragged the hint says to drop it, and the link keeps its URL', async () => {
    const { link } = await renderWithButton();
    const dragHint = screen.getByText('Перетягни на панель закладок');
    const dropHint = screen.getByText('Відпусти на панелі закладок');
    expect(dropHint.getAttribute('aria-hidden')).toBe('true');

    fireEvent.dragStart(link);

    expect(dropHint.getAttribute('aria-hidden')).toBe('false');
    expect(dragHint.getAttribute('aria-hidden')).toBe('true');
    expect(link.getAttribute('href')).toBe(hrefOf('capture-token-one'));

    fireEvent.dragEnd(link);

    expect(dropHint.getAttribute('aria-hidden')).toBe('true');
  });

  it('the copy button puts the same bookmarklet URL on the clipboard', async () => {
    const { user } = await renderWithButton();

    await user.click(screen.getByRole('button', { name: 'Скопіювати код закладки' }));

    expect(await screen.findByText('Скопійовано')).toBeDefined();
    expect(await navigator.clipboard.readText()).toBe(hrefOf('capture-token-one'));
  });

  it('shows when the newest capture token was created and last used, in the user time zone, and no link', async () => {
    renderSection({ items: [USED_TOKEN, UNUSED_TOKEN] });

    expect(await screen.findByText(USED_AT_IN_KYIV)).toBeDefined();
    expect(screen.getByText('09.11, 00:30')).toBeDefined();
    expect(screen.queryByText(NEVER_USED)).toBeNull();
    expect(screen.queryByRole('link', LINK)).toBeNull();
    expect(screen.queryByRole('button', CREATE)).toBeNull();
  });

  it('a capture token nobody used yet says so', async () => {
    renderSection({ items: [UNUSED_TOKEN] });

    expect(await screen.findByText(NEVER_USED)).toBeDefined();
  });

  it('coming back to the tab reads the last used time again', async () => {
    const { store } = renderSection({ items: [UNUSED_TOKEN] });
    await screen.findByText(NEVER_USED);
    store.items = [{ ...UNUSED_TOKEN, lastUsedAt: USED_TOKEN.lastUsedAt }];

    returnToTab();

    expect(await screen.findByText(USED_AT_IN_KYIV)).toBeDefined();
  });

  it('hides the link once the list no longer holds its capture token', async () => {
    const { store } = await renderWithButton();
    store.items = [];

    returnToTab();

    expect(await screen.findByRole('button', CREATE)).toBeDefined();
    expect(screen.queryByRole('link', LINK)).toBeNull();
  });

  it('Нова кнопка warns that the old bookmark stops working, and Скасувати sends nothing', async () => {
    const { user, sent } = await renderWithButton();

    const { warning, open } = await cancelConfirm(user, REGENERATE);

    expect(warning).toContain('Закладка, що вже стоїть на панелі, перестане працювати');
    expect(open).toBeNull();
    expect(sent).toEqual(['POST']);
  });

  it('confirming Нова кнопка sends one POST and the link holds the new capture token', async () => {
    const { user, sent } = await renderWithButton();

    await confirm(user, REGENERATE);

    await waitFor(() => {
      expect(screen.getByRole('link', LINK).getAttribute('href')).toBe(hrefOf('capture-token-two'));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent).toEqual(['POST', 'POST']);
    expect(await screen.findByText('Нова кнопка готова')).toBeDefined();
    expect(
      screen.getByText(
        'Стара закладка більше не працює. Перетягни нову кнопку на панель закладок.',
      ),
    ).toBeDefined();
  });

  it.each(OUTAGES)(
    'when Створити нову $name the link stays with the capture token it had',
    async ({ reply, settled }) => {
      const posts: (HttpResponseResolver | undefined)[] = [undefined, reply];
      const { user } = await renderWithButton({
        replies: { create: (info) => posts.shift()?.(info) },
      });

      await confirm(user, REGENERATE);

      expect(await REGENERATE_OUTAGE_SHOWS[settled]()).toBeDefined();
      expect(screen.getByRole('link', LINK_BEHIND_DIALOG).getAttribute('href')).toBe(
        hrefOf('capture-token-one'),
      );
      expect(screen.queryByText(SHOWN_ONCE)).toBeNull();
    },
  );

  it('the installed state has no accessibility violations', async () => {
    await renderWithButton();
    await screen.findByText(NEVER_USED);

    expect(await axeViolations()).toEqual([]);
  });

  it('Вимкнути букмарклет warns that the bookmark on the bar stops working, and Скасувати sends nothing', async () => {
    const { user, sent } = renderSection({ items: [USED_TOKEN, UNUSED_TOKEN] });

    const { warning, open } = await cancelConfirm(user, REVOKE);

    expect(warning).toContain('Закладка на панелі перестане працювати');
    expect(open).toBeNull();
    expect(sent).toEqual([]);
  });

  it('confirming Вимкнути sends a DELETE for every listed capture token and creates nothing', async () => {
    const { user, sent } = renderSection({ items: [USED_TOKEN, UNUSED_TOKEN] });

    await confirm(user, REVOKE);

    expect(await screen.findByRole('button', CREATE)).toBeDefined();
    expect(await screen.findByText('Букмарклет вимкнено')).toBeDefined();
    expect(sent).toHaveLength(2);
    expect(new Set(sent)).toEqual(
      new Set([`DELETE ${USED_TOKEN.id}`, `DELETE ${UNUSED_TOKEN.id}`]),
    );
  });

  it('after Вимкнути the link is gone and the create button is back', async () => {
    const { user, sent } = await renderWithButton();

    await confirm(user, REVOKE);

    expect(await screen.findByRole('button', CREATE)).toBeDefined();
    expect(screen.queryByRole('link', LINK)).toBeNull();
    expect(sent).toEqual(['POST', 'DELETE 0b6f3c1e-5d2a-4c8e-9f10-0000000000d1']);
  });

  it('after Вимкнути focus lands on the create button', async () => {
    const { user } = renderSection({ items: [USED_TOKEN] });

    await confirm(user, REVOKE);

    const create = await screen.findByRole('button', CREATE);
    await waitFor(() => {
      expect(document.activeElement).toBe(create);
    });
  });

  it('a create button that a background refetch brings after a failed Вимкнути takes no focus', async () => {
    const view = renderSection({ items: [USED_TOKEN], replies: { revoke: SERVER_ERROR } });
    await confirm(view.user, REVOKE);
    await screen.findByRole('button', { name: REVOKE.press, busy: false });
    await view.user.click(screen.getByRole('button', CANCEL));

    const create = await createButtonOnceListEmpties(view);

    expect(create.isConnected).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });

  it('a create button that a background refetch brings after Вимкнути and a new button takes no focus', async () => {
    const view = renderSection({ items: [USED_TOKEN] });
    await confirm(view.user, REVOKE);
    await view.user.click(await screen.findByRole('button', CREATE));
    await screen.findByRole('link', LINK);

    const create = await createButtonOnceListEmpties(view);

    expect(create.isConnected).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });

  it('a capture token the server already revoked counts as switched off', async () => {
    const { user } = renderSection({
      items: [USED_TOKEN],
      replies: { revoke: () => errorReply({ status: 404, type: 'not_found' }) },
    });

    await confirm(user, REVOKE);

    expect(await screen.findByText('Букмарклет вимкнено')).toBeDefined();
    expect(screen.queryByText(REVOKE_FAILED)).toBeNull();
  });

  it.each(OUTAGES)(
    'when Вимкнути $name it says the old bookmark may still work, keeps the dialog open and its buttons usable',
    async ({ reply, settled }) => {
      fakeTimeouts();
      const { user, sent } = renderSection({ items: [USED_TOKEN], replies: { revoke: reply } });

      await confirm(user, REVOKE);
      if (settled === 'pending') await advanceBy(API_CLIENT_LIMITS.requestTimeoutMs);

      expect(await screen.findByText(REVOKE_FAILED)).toBeDefined();
      expect(screen.getByRole('dialog', { name: REVOKE.dialog })).toBeDefined();
      expect(sent).toEqual([`DELETE ${USED_TOKEN.id}`]);
      expect(await screen.findByRole('button', { name: REVOKE.press, busy: false })).toHaveProperty(
        'disabled',
        false,
      );
      await user.click(screen.getByRole('button', CANCEL));
      expect(screen.queryByRole('dialog')).toBeNull();
    },
  );

  it('with two capture tokens and one DELETE failing, reads the list again and shows the token that is left', async () => {
    const { user } = renderSection({
      items: [USED_TOKEN, UNUSED_TOKEN],
      replies: {
        revoke: ({ params }) => (params.id === UNUSED_TOKEN.id ? SERVER_ERROR() : undefined),
      },
    });

    await confirm(user, REVOKE);

    expect(await screen.findByText(REVOKE_FAILED)).toBeDefined();
    expect(await screen.findByText(NEVER_USED)).toBeDefined();
    expect(screen.queryByText(USED_AT_IN_KYIV)).toBeNull();
  });

  it.each(OUTAGES)(
    'when creating the capture token $name it says so and no link appears',
    async ({ reply, settled }) => {
      const { user, sent } = renderSection({ replies: { create: reply } });

      await user.click(await screen.findByRole('button', CREATE));

      expect(await CREATE_OUTAGE_SHOWS[settled]()).toBeDefined();
      expect(screen.queryByRole('link', LINK)).toBeNull();
      expect(sent).toEqual(['POST']);
    },
  );

  it('after a failed create the button works again', async () => {
    const failures = [SERVER_ERROR];
    const { user } = renderSection({ replies: { create: () => failures.shift()?.() } });
    await user.click(await screen.findByRole('button', CREATE));
    await screen.findByText(CREATE_FAILED);

    await user.click(screen.getByRole('button', CREATE));

    expect(await screen.findByRole('link', LINK)).toBeDefined();
  });

  it('leaving the section drops the capture token from the mutation cache', async () => {
    server.use(meRoute(), ...captureTokenRoutes().handlers);
    const { user, view } = renderViewInApp(
      <>
        <HeldMutationData />
        <InstallBookmarklet />
      </>,
    );
    await user.click(await screen.findByRole('button', CREATE));
    await screen.findByRole('link', LINK);
    expect(screen.getByLabelText(HELD_MUTATION_DATA).textContent).toContain('capture-token-one');

    view.rerender(<HeldMutationData />);

    await waitFor(() => {
      expect(screen.getByLabelText(HELD_MUTATION_DATA).textContent).toBe('[]');
    });
  });

  it('explains what the bookmarklet sends, who can read its token, what to do on a leak and the local network prompt', async () => {
    renderSection();
    await waitForQuery({ queryKey: LIST_KEY, status: 'success' });

    expect(
      screen.getByText(
        'Букмарклет надсилає лише ту сторінку, яку ти бачиш, і лише тоді, коли ти на нього тиснеш.',
      ),
    ).toBeDefined();
    expect(
      screen.getByText(/скрипти самої сторінки вакансії можуть прочитати його токен/),
    ).toBeDefined();
    expect(
      screen.getByText(/створи нову кнопку: старий токен одразу перестане діяти/),
    ).toBeDefined();
    expect(
      screen.getByText(
        /Цей токен уміє створювати чернетки, а у відповідь показує, чи вакансія з такою адресою вже є у твоїй воронці: компанію, посаду, етап і дату відгуку\./,
      ),
    ).toBeDefined();
    expect(
      screen.getByText(/Зміна пароля і «Вийти на всіх пристроях» теж вимикають букмарклет\./),
    ).toBeDefined();
    expect(
      screen.getByText(/браузер може спитати дозвіл на доступ до локальної мережі/),
    ).toBeDefined();
    expect(
      screen.getByText(
        /Дозвіл отримує весь цей сайт, а не лише букмарклет\. Забрати його можна в налаштуваннях сайту в браузері\./,
      ),
    ).toBeDefined();
  });
});
