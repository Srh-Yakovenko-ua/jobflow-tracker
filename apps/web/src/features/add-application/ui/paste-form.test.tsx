import { screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACME_DUPLICATE,
  addRoutes,
  type AddRoutesOptions,
  addsOnceOnDoubleClick,
  FIRST_PASTE,
  NO_ACTIVE_SEARCH,
  TWO_MINUTES,
} from '@/test/add-fixtures';
import {
  ANY_IDEMPOTENCY_KEY,
  apiUrl,
  errorReply,
  rateLimitedReply,
  recordSentRequests,
  validationReply,
} from '@/test/api-handlers';
import { descriptionOf } from '@/test/field-description';
import { latch } from '@/test/latch';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import type { AddPrefill } from '../lib/add-prefill';
import type { CapturedDraft } from '../model/use-add-application';
import { PasteForm } from './paste-form';

type PasteSetup = AddRoutesOptions & { prefill?: AddPrefill };

const TEXT = 'Текст вакансії';

const LINK = 'Посилання на вакансію';

const SUBMIT = 'Розібрати текст';

const ANOTHER = 'Додати ще одну';

const PARSING = 'Текст розбирається у фоні, поля підтягнуться самі.';

const DUPLICATE = 'Схожа вакансія вже є на дошці';

const TEXT_REFUSED = /^Встав текст вакансії, не довший за 20\s000 символів$/;

const VACANCY = 'Senior QA Engineer\nKvit Software шукає тестувальника';

const NOTHING: AddPrefill = {
  text: '',
  url: '',
  focusPaste: false,
  reviewId: null,
  jobId: null,
};

const ROUNDS = [1, 2, 3, 4, 5, 6];

function renderPasteForm({ prefill = NOTHING, ...routes }: PasteSetup = {}) {
  const added = addRoutes(routes);
  server.use(...added.handlers);
  const captured: CapturedDraft[] = [];
  const onCaptured = (capture: CapturedDraft) => {
    captured.push(capture);
  };
  const user = renderInApp(<PasteForm prefill={prefill} actions={{ onCaptured }} />);
  return { user, sent: added.sent.pasted, captured };
}

function textField() {
  return screen.getByRole<HTMLTextAreaElement>('textbox', { name: TEXT });
}

function linkField() {
  return screen.getByRole<HTMLInputElement>('textbox', { name: LINK });
}

async function pasteVacancy(user: ReturnType<typeof renderInApp>, text = VACANCY) {
  await user.click(textField());
  await user.paste(text);
}

async function sendVacancy(user: ReturnType<typeof renderInApp>) {
  await pasteVacancy(user);
  await user.click(screen.getByRole('button', { name: SUBMIT }));
}

describe('PasteForm', () => {
  afterEach(() => {
    toast.dismiss();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('a pasted text goes out with a null url, then the added block takes the focus', async () => {
    const { user, sent, captured } = renderPasteForm();

    await sendVacancy(user);

    expect(await screen.findByText(PARSING)).toBeDefined();
    expect(sent).toEqual([
      { body: { text: VACANCY, url: null }, idempotencyKey: ANY_IDEMPOTENCY_KEY },
    ]);
    expect(captured).toEqual([FIRST_PASTE]);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: ANOTHER }));
    expect(screen.getByRole('link', { name: 'До дошки' }).getAttribute('href')).toBe('/board');
    expect(screen.queryByText(DUPLICATE)).toBeNull();
  });

  it('a typed vacancy link goes out beside the text', async () => {
    const { user, sent } = renderPasteForm();

    await user.type(linkField(), 'https://djinni.co/jobs/1');
    await sendVacancy(user);

    await screen.findByText(PARSING);
    expect(sent.map(({ body }) => body)).toEqual([
      { text: VACANCY, url: 'https://djinni.co/jobs/1' },
    ]);
  });

  it.each(['Meta', 'Control'])('%s+Enter in the text field sends the paste', async (modifier) => {
    const { user, sent } = renderPasteForm();
    await pasteVacancy(user);

    await user.keyboard(`{${modifier}>}{Enter}{/${modifier}}`);

    await screen.findByText(PARSING);
    expect(sent.map(({ body }) => body)).toEqual([{ text: VACANCY, url: null }]);
  });

  it('a plain Enter in the text field sends nothing', async () => {
    const { user, sent } = renderPasteForm();
    await pasteVacancy(user);

    await user.keyboard('{Enter}');

    expect(textField().value).toBe(`${VACANCY}\n`);
    expect(sent).toEqual([]);
  });

  it('"Додати ще одну" brings back a blank form with the focus in the text field, even after a prefill', async () => {
    const prefill = {
      ...NOTHING,
      text: 'Kvit шукає QA',
      url: 'https://djinni.co/jobs/1',
      focusPaste: true,
    };
    const { user } = renderPasteForm({ prefill });
    expect(textField().value).toBe('Kvit шукає QA');
    expect(linkField().value).toBe('https://djinni.co/jobs/1');
    expect(document.activeElement).toBe(textField());

    await user.click(screen.getByRole('button', { name: SUBMIT }));
    await user.click(await screen.findByRole('button', { name: ANOTHER }));

    expect(textField().value).toBe('');
    expect(linkField().value).toBe('');
    expect(document.activeElement).toBe(textField());
  });

  it('six pastes in a row each go out at once', async () => {
    const { user, sent } = renderPasteForm();
    const sentRequests = recordSentRequests();

    for (const round of ROUNDS) {
      await pasteVacancy(user, `Vacancy ${String(round)}`);
      await user.click(screen.getByRole('button', { name: SUBMIT }));
      await user.click(await screen.findByRole('button', { name: ANOTHER }));
    }

    expect(sent.map(({ body }) => body)).toEqual(
      ROUNDS.map((round) => ({ text: `Vacancy ${String(round)}`, url: null })),
    );
    expect(new Set(sent.map(({ idempotencyKey }) => idempotencyKey)).size).toBe(6);
    expect(sent.map(({ idempotencyKey }) => idempotencyKey)).not.toContain(null);
    expect(sentRequests().map(({ url, method }) => ({ url, method }))).toEqual(
      ROUNDS.map(() => ({ url: apiUrl('/capture/paste'), method: 'POST' })),
    );
  });

  it('a double click while the first paste is on its way sends one', async () => {
    const held = latch();
    const { user, sent } = renderPasteForm({ paste: { latch: held } });
    await pasteVacancy(user);

    await addsOnceOnDoubleClick({ user, held, sent, submit: SUBMIT, another: ANOTHER });
  });

  it('a 422 on the text shows under the field and keeps the form', async () => {
    const refused = () =>
      validationReply([{ path: 'text', message: 'text must not contain NUL characters' }]);
    const { user, sent } = renderPasteForm({ paste: { reply: refused } });

    await sendVacancy(user);

    await waitFor(() => {
      expect(descriptionOf(textField())).toMatch(TEXT_REFUSED);
    });
    expect(sent).toHaveLength(1);
    expect(textField().value).toBe(VACANCY);
    expect(screen.queryByRole('button', { name: ANOTHER })).toBeNull();
  });

  it('an empty text is refused before anything is sent', async () => {
    const { user, sent } = renderPasteForm();

    await user.click(screen.getByRole('button', { name: SUBMIT }));

    await waitFor(() => {
      expect(descriptionOf(textField())).toMatch(TEXT_REFUSED);
    });
    expect(sent).toEqual([]);
  });

  it('a link that is not http or https is refused before anything is sent', async () => {
    const { user, sent } = renderPasteForm();
    await user.type(linkField(), 'ftp://files.example.com/vacancy');

    await sendVacancy(user);

    await waitFor(() => {
      expect(descriptionOf(linkField())).toBe('Посилання має починатися з http:// або https://');
    });
    expect(sent).toEqual([]);
  });

  it('a 409 says there is no active search and keeps the typed text', async () => {
    const { user } = renderPasteForm({ paste: { reply: () => errorReply(NO_ACTIVE_SEARCH) } });

    await sendVacancy(user);

    expect(await screen.findByText('Немає активного пошуку')).toBeDefined();
    expect(textField().value).toBe(VACANCY);
    expect(screen.queryByRole('button', { name: ANOTHER })).toBeNull();
  });

  it('a 429 says how long to wait and keeps the typed text', async () => {
    const { user } = renderPasteForm({ paste: { reply: () => rateLimitedReply(TWO_MINUTES) } });

    await sendVacancy(user);

    expect(
      await screen.findByText('Спробуй через 2 хв. Усе введене лишилось у формі.'),
    ).toBeDefined();
    expect(textField().value).toBe(VACANCY);
  });

  it('a 500 shows the save failure and keeps the typed text', async () => {
    const down = () => errorReply({ status: 500, type: 'internal_error' });
    const { user } = renderPasteForm({ paste: { reply: down } });

    await sendVacancy(user);

    expect(
      await screen.findByText('Це збій на нашому боці, збережені дані на місці. Спробуй ще раз.'),
    ).toBeDefined();
    expect(textField().value).toBe(VACANCY);
  });

  it('a possible duplicate is named in the added block with a link to its card', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
    server.use(meRoute());
    const { user } = renderPasteForm({ duplicates: [ACME_DUPLICATE] });

    await sendVacancy(user);

    const warning = (await screen.findByText(DUPLICATE)).closest('[role="status"]');
    const card = screen.getByRole('link', { name: 'Acme Technologies · Senior React Developer' });
    expect(card.getAttribute('href')).toBe(`/applications/${ACME_DUPLICATE.id}`);
    expect(warning?.textContent).toContain("техінтерв'ю · відгук 12.10");
    expect(screen.getByRole('button', { name: ANOTHER })).toBeDefined();
  });
});
