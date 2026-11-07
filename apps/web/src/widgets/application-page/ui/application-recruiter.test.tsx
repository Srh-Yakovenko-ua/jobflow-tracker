import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { fixtureIdOf } from '@/test/board-fixtures';
import {
  contactOf,
  contactRoutes,
  type ContactRoutesOptions,
  DESIGN_CONTACT,
} from '@/test/contact-fixtures';
import { latch } from '@/test/latch';
import { back } from '@/test/navigation';
import { renderApplicationPage } from '@/test/render-application-page';
import { server } from '@/test/server';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const EDIT = 'Редагувати рекрутера';

const TRANSIENT_RETRY_MS = 3000;

const FAILED = { reply: () => errorReply({ status: 500, type: 'internal_error' }) };

const OTHER_RECRUITER = contactOf({
  id: fixtureIdOf(702),
  applicationId: fixtureIdOf(9),
  name: 'Ірина Бойко',
  role: 'HR',
});

async function findRecruiter(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: 'Рекрутер' });
}

function renderRecruiter(contacts: ContactRoutesOptions = { items: [DESIGN_CONTACT] }) {
  return renderApplicationPage({ contacts });
}

function editButton(): HTMLElement {
  return screen.getByRole('button', { name: EDIT });
}

describe('ApplicationRecruiter', () => {
  beforeEach(() => {
    back.mockClear();
  });

  it('shows the recruiter with the company and the links to write to them', async () => {
    renderRecruiter();
    const section = await findRecruiter();

    expect(await within(section).findByText('Оксана Левченко')).toBeDefined();
    expect(within(section).getByText('Talent Partner, Acme Technologies')).toBeDefined();
    const email = within(section).getByRole('link', { name: 'email o.levchenko@acme.io' });
    const telegram = within(section).getByRole('link', { name: 'telegram @oksana_hr' });
    expect([email.getAttribute('href'), email.getAttribute('target')]).toEqual([
      'mailto:o.levchenko@acme.io',
      null,
    ]);
    expect(['href', 'target', 'rel'].map((name) => telegram.getAttribute(name))).toEqual([
      'https://t.me/oksana_hr',
      '_blank',
      'noreferrer',
    ]);
    expect(within(section).getByText('~14 год')).toBeDefined();
  });

  it('a recruiter with no answers yet has no response row and only the company under the name', async () => {
    renderRecruiter({ items: [contactOf({ name: 'Оксана Левченко' })] });
    const section = await findRecruiter();

    await within(section).findByText('Оксана Левченко');

    expect(within(section).getByText('Acme Technologies')).toBeDefined();
    expect(within(section).queryByText('відповідає за')).toBeNull();
    expect(within(section).queryAllByRole('link')).toEqual([]);
  });

  it('copying the telegram puts the handle with @ on the clipboard', async () => {
    const { user } = renderRecruiter();
    const section = await findRecruiter();

    await user.click(await within(section).findByRole('button', { name: 'Скопіювати telegram' }));

    await waitFor(async () => {
      expect(await navigator.clipboard.readText()).toBe('@oksana_hr');
    });
  });

  it('adding the first recruiter shows them and moves focus to the edit button', async () => {
    const { user, contacts } = renderRecruiter({ suggestions: [OTHER_RECRUITER] });
    const section = await findRecruiter();

    await user.type(await within(section).findByRole('textbox', { name: "Ім'я" }), 'Оксана');
    await user.click(within(section).getByRole('button', { name: 'Додати рекрутера' }));

    await waitFor(() => {
      expect(document.activeElement).toBe(editButton());
    });
    expect(within(section).getByText('Оксана')).toBeDefined();
    expect(within(section).queryByText('Контакти з інших відгуків')).toBeNull();
    expect(contacts.created).toEqual([
      { id: ACME_APPLICATION.id, body: { name: 'Оксана' }, idempotencyKey: null },
    ]);
  });

  it('other applications offer their recruiters only while this card has none', async () => {
    renderRecruiter({ items: [DESIGN_CONTACT], suggestions: [OTHER_RECRUITER] });
    const section = await findRecruiter();

    await within(section).findByText('Оксана Левченко');

    expect(within(section).queryByRole('button', { name: /Ірина Бойко/ })).toBeNull();
  });

  it('a cleared role is saved as null and focus returns to the edit button', async () => {
    const { user, contacts } = renderRecruiter();
    const section = await findRecruiter();
    await within(section).findByText('Оксана Левченко');

    await user.click(editButton());
    await user.clear(within(section).getByRole('textbox', { name: 'Роль' }));
    await user.click(within(section).getByRole('button', { name: 'Зберегти' }));

    await waitFor(() => {
      expect(document.activeElement).toBe(editButton());
    });
    expect(await within(section).findByText('Acme Technologies')).toBeDefined();
    expect(contacts.updated.map(({ body }) => body.role)).toEqual([null]);
  });

  it('Escape in the recruiter editor closes only the editor and keeps the sheet open', async () => {
    const { user, contacts } = renderApplicationPage({
      mode: 'sheet',
      contacts: { items: [DESIGN_CONTACT] },
    });
    const section = await findRecruiter();
    await within(section).findByText('Оксана Левченко');

    await user.click(editButton());
    await user.keyboard('{Escape}');

    expect(within(section).queryByRole('textbox', { name: 'Роль' })).toBeNull();
    expect(document.activeElement).toBe(editButton());
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(back).not.toHaveBeenCalled();
    expect(contacts.updated).toEqual([]);
  });

  it('a failed load offers a retry that brings the recruiter', async () => {
    const { user } = renderRecruiter({ list: FAILED });
    const section = await findRecruiter();
    const retry = await within(section).findByRole(
      'button',
      { name: 'Спробувати ще раз' },
      { timeout: TRANSIENT_RETRY_MS },
    );
    server.use(...contactRoutes({ items: [DESIGN_CONTACT] }).handlers);

    await user.click(retry);

    expect(await within(section).findByText('Оксана Левченко')).toBeDefined();
  });

  it('while the recruiter loads the block is busy and offers nothing to edit', async () => {
    renderRecruiter({ items: [DESIGN_CONTACT], list: { latch: latch() } });
    const section = await findRecruiter();

    expect(section.getAttribute('aria-busy')).toBe('true');
    expect(within(section).queryByRole('button')).toBeNull();
    expect(within(section).queryByRole('textbox')).toBeNull();
  });
});
