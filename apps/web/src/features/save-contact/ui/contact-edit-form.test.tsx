import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import {
  CONTACT_ID,
  contactRoutes,
  type ContactRoutesOptions,
  DESIGN_CONTACT,
} from '@/test/contact-fixtures';
import { descriptionOf } from '@/test/field-description';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { ContactEditForm } from './contact-edit-form';

const LABELS = { name: "Ім'я", role: 'Роль', email: 'Email', telegram: 'Telegram' } as const;

function renderEditor(update: ContactRoutesOptions['update'] = {}) {
  const routes = contactRoutes({ items: [DESIGN_CONTACT], update });
  server.use(...routes.handlers);
  const actions = { onDone: vi.fn(), onCancel: vi.fn() };
  const user = renderInApp(<ContactEditForm contact={DESIGN_CONTACT} actions={actions} />);
  return { user, sent: routes.sent, actions };
}

function fieldNamed(label: string): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>('textbox', { name: label });
}

describe('ContactEditForm', () => {
  it('opens on the name with the four saved values', () => {
    renderEditor();

    expect(document.activeElement).toBe(fieldNamed(LABELS.name));
    expect(Object.values(LABELS).map((label) => fieldNamed(label).value)).toEqual([
      'Оксана Левченко',
      'Talent Partner',
      'o.levchenko@acme.io',
      'oksana_hr',
    ]);
  });

  it('a cleared role is saved as null and the editor closes', async () => {
    const { user, sent, actions } = renderEditor();

    await user.clear(fieldNamed(LABELS.role));
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));

    await waitFor(() => {
      expect(actions.onDone).toHaveBeenCalledTimes(1);
    });
    expect(sent.updated).toEqual([
      {
        itemId: CONTACT_ID,
        body: {
          name: 'Оксана Левченко',
          role: null,
          email: 'o.levchenko@acme.io',
          telegram: 'oksana_hr',
        },
      },
    ]);
  });

  it('Escape cancels the edit and sends nothing', async () => {
    const { user, sent, actions } = renderEditor();

    await user.type(fieldNamed(LABELS.role), ' Lead');
    await user.keyboard('{Escape}');

    expect(actions.onCancel).toHaveBeenCalledTimes(1);
    expect(sent.updated).toEqual([]);
  });

  it('a 422 on telegram shows under that field and keeps the editor open', async () => {
    const refused = () =>
      errorReply({
        status: 422,
        type: 'validation_error',
        errors: [{ path: 'telegram', message: 'telegram must be a handle' }],
      });
    const { user, sent, actions } = renderEditor({ reply: refused });

    await user.click(screen.getByRole('button', { name: 'Зберегти' }));

    await waitFor(() => {
      expect(descriptionOf(fieldNamed(LABELS.telegram))).toBe(
        'Нік із 5–32 латинських літер, цифр або _, без посилання',
      );
    });
    expect(sent.updated).toHaveLength(1);
    expect(actions.onDone).not.toHaveBeenCalled();
  });

  it('a telegram link is refused under the field before anything is sent', async () => {
    const { user, sent } = renderEditor();
    const telegram = fieldNamed(LABELS.telegram);

    await user.clear(telegram);
    await user.type(telegram, 'https://t.me/oksana_hr{Enter}');

    await waitFor(() => {
      expect(descriptionOf(telegram)).toBe(
        'Нік із 5–32 латинських літер, цифр або _, без посилання',
      );
    });
    expect(sent.updated).toEqual([]);
  });
});
