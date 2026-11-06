import type { Contact } from '@jobflow/shared';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { fixtureIdOf } from '@/test/board-fixtures';
import { contactOf, contactRoutes, type ContactRoutesOptions } from '@/test/contact-fixtures';
import { descriptionOf } from '@/test/field-description';
import { latch } from '@/test/latch';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { AddContactForm } from './add-contact-form';

const ADD = 'Додати рекрутера';

const NAME = "Ім'я";

const IHOR = contactOf({
  id: fixtureIdOf(702),
  applicationId: fixtureIdOf(202),
  name: 'Ігор Савчук',
  role: 'Engineering Manager',
  telegram: 'ihor_em',
});

type AddFormSetup = Readonly<{
  suggestions?: readonly Contact[];
  create?: ContactRoutesOptions['create'];
}>;

function renderAddForm({ suggestions = [], create = {} }: AddFormSetup = {}) {
  const routes = contactRoutes({ suggestions, create });
  server.use(...routes.handlers);
  const onDone = vi.fn();
  const user = renderInApp(
    <AddContactForm
      application={ACME_APPLICATION}
      suggestions={suggestions}
      actions={{ onDone }}
    />,
  );
  return { user, sent: routes.sent, onDone };
}

describe('AddContactForm', () => {
  it('starts a recruiter from one name field and posts only the trimmed name', async () => {
    const { user, sent, onDone } = renderAddForm();

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    await user.type(screen.getByRole('textbox', { name: NAME }), '  Оксана Левченко ');
    await user.click(screen.getByRole('button', { name: ADD }));

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1);
    });
    expect(sent.created).toEqual([{ id: ACME_APPLICATION.id, body: { name: 'Оксана Левченко' } }]);
  });

  it('a double click while the first add is on its way posts one recruiter', async () => {
    const held = latch();
    const { user, sent, onDone } = renderAddForm({ create: { latch: held } });
    await user.type(screen.getByRole('textbox', { name: NAME }), 'Оксана Левченко');

    await user.dblClick(screen.getByRole('button', { name: ADD }));
    await waitFor(() => {
      expect(sent.created).toHaveLength(1);
    });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: ADD }).disabled).toBe(true);
    held.release();

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1);
    });
    expect(sent.created).toHaveLength(1);
  });

  it('a contact from another application of the company is added with the fields it has', async () => {
    const { user, sent, onDone } = renderAddForm({ suggestions: [IHOR] });

    await user.click(screen.getByRole('button', { name: 'Ігор Савчук, Engineering Manager' }));

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1);
    });
    expect(sent.created).toEqual([
      {
        id: ACME_APPLICATION.id,
        body: { name: 'Ігор Савчук', role: 'Engineering Manager', telegram: 'ihor_em' },
      },
    ]);
  });

  it('a 422 on the name shows under the field and keeps the form', async () => {
    const refused = () =>
      errorReply({
        status: 422,
        type: 'validation_error',
        errors: [{ path: 'name', message: 'name must not contain NUL characters' }],
      });
    const { user, sent, onDone } = renderAddForm({ create: { reply: refused } });
    const name = screen.getByRole('textbox', { name: NAME });

    await user.type(name, 'Оксана{Enter}');

    await waitFor(() => {
      expect(descriptionOf(name)).toBe("Вкажи ім'я одним коротким рядком");
    });
    expect(sent.created).toHaveLength(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('a blank name is refused before anything is sent', async () => {
    const { user, sent } = renderAddForm();
    const name = screen.getByRole('textbox', { name: NAME });

    await user.type(name, '   {Enter}');

    await waitFor(() => {
      expect(descriptionOf(name)).toBe("Вкажи ім'я одним коротким рядком");
    });
    expect(sent.created).toEqual([]);
  });
});
