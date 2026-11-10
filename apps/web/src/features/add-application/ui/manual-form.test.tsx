import { screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import {
  addRoutes,
  type AddRoutesOptions,
  addsOnceOnDoubleClick,
  NO_ACTIVE_SEARCH,
  TWO_MINUTES,
} from '@/test/add-fixtures';
import {
  ANY_IDEMPOTENCY_KEY,
  errorReply,
  rateLimitedReply,
  validationReply,
} from '@/test/api-handlers';
import { descriptionOf } from '@/test/field-description';
import { latch } from '@/test/latch';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { ManualForm } from './manual-form';

const COMPANY = 'Компанія';

const POSITION = 'Позиція';

const SOURCE = 'Джерело';

const SUBMIT = 'Створити картку';

const ANOTHER = 'Додати ще одну';

const CREATED = 'Картку створено без Match Score: для нього потрібен текст вакансії.';

const COMPANY_REFUSED = 'Вкажи назву компанії одним коротким рядком';

function renderManualForm(routes: AddRoutesOptions = {}) {
  const added = addRoutes(routes);
  server.use(...added.handlers);
  const user = renderInApp(<ManualForm />);
  return { user, sent: added.sent.created };
}

function field(name: string) {
  return screen.getByRole<HTMLInputElement>('textbox', { name });
}

async function fillRequired(user: ReturnType<typeof renderInApp>) {
  await user.type(field(COMPANY), 'Kvit Software');
  await user.type(field(POSITION), 'Middle QA Engineer');
}

async function sendRequired(user: ReturnType<typeof renderInApp>) {
  await fillRequired(user);
  await user.click(screen.getByRole('button', { name: SUBMIT }));
}

describe('ManualForm', () => {
  afterEach(() => {
    toast.dismiss();
  });

  it('a company and a position alone create a card from the source "other", then the added block takes the focus', async () => {
    const { user, sent } = renderManualForm();
    expect(document.activeElement).toBe(document.body);

    await sendRequired(user);

    expect(await screen.findByText(CREATED)).toBeDefined();
    expect(sent).toEqual([
      {
        body: {
          company: 'Kvit Software',
          position: 'Middle QA Engineer',
          source: 'other',
          stack: [],
        },
        idempotencyKey: ANY_IDEMPOTENCY_KEY,
      },
    ]);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: ANOTHER }));
    expect(screen.getByRole('link', { name: 'До дошки' }).getAttribute('href')).toBe('/board');
  });

  it('empty required fields show their errors and send nothing', async () => {
    const { user, sent } = renderManualForm();

    await user.click(screen.getByRole('button', { name: SUBMIT }));

    await waitFor(() => {
      expect(descriptionOf(field(COMPANY))).toBe(COMPANY_REFUSED);
    });
    expect(descriptionOf(field(POSITION))).toBe('Вкажи позицію одним коротким рядком');
    expect(sent).toEqual([]);
  });

  it('the source select offers every source and sends the picked one', async () => {
    const { user, sent } = renderManualForm();
    await fillRequired(user);

    await user.click(screen.getByRole('combobox', { name: SOURCE }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Djinni',
      'DOU',
      'robota.ua',
      'Work.ua',
      'LinkedIn',
      'рефералка',
      'сайт компанії',
      'інше',
    ]);
    await user.click(screen.getByRole('option', { name: 'Work.ua' }));
    await user.click(screen.getByRole('button', { name: SUBMIT }));

    await screen.findByText(CREATED);
    expect(sent.map(({ body }) => body)).toMatchObject([{ source: 'workua' }]);
  });

  it('"Додати ще одну" brings back a blank form with the focus in the company field', async () => {
    const { user } = renderManualForm();
    await sendRequired(user);

    await user.click(await screen.findByRole('button', { name: ANOTHER }));

    expect(field(COMPANY).value).toBe('');
    expect(field(POSITION).value).toBe('');
    expect(document.activeElement).toBe(field(COMPANY));
  });

  it('a double click while the first create is on its way creates one card', async () => {
    const held = latch();
    const { user, sent } = renderManualForm({ manual: { latch: held } });
    await fillRequired(user);

    await addsOnceOnDoubleClick({ user, held, sent, submit: SUBMIT, another: ANOTHER });
  });

  it('a 422 on the company shows under the field and keeps the form', async () => {
    const refused = () =>
      validationReply([{ path: 'company', message: 'company must not contain NUL characters' }]);
    const { user, sent } = renderManualForm({ manual: { reply: refused } });

    await sendRequired(user);

    await waitFor(() => {
      expect(descriptionOf(field(COMPANY))).toBe(COMPANY_REFUSED);
    });
    expect(sent).toHaveLength(1);
    expect(field(POSITION).value).toBe('Middle QA Engineer');
  });

  it('a 409 says there is no active search and keeps what was typed', async () => {
    const { user } = renderManualForm({ manual: { reply: () => errorReply(NO_ACTIVE_SEARCH) } });

    await sendRequired(user);

    expect(await screen.findByText('Немає активного пошуку')).toBeDefined();
    expect(field(COMPANY).value).toBe('Kvit Software');
    expect(field(POSITION).value).toBe('Middle QA Engineer');
    expect(screen.queryByRole('button', { name: ANOTHER })).toBeNull();
  });

  it('a 429 says too many requests and does not mention parses', async () => {
    const limited = () => rateLimitedReply(TWO_MINUTES);
    const { user } = renderManualForm({ manual: { reply: limited } });

    await sendRequired(user);

    expect(await screen.findByText('Забагато запитів')).toBeDefined();
    expect(screen.getByText('Спробуй через 2 хв. Усе введене лишилось у формі.')).toBeDefined();
    expect(screen.queryByText(/розбор/i)).toBeNull();
    expect(field(COMPANY).value).toBe('Kvit Software');
  });
});
