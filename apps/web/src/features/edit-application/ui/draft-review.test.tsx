import type { ApplicationResponse } from '@jobflow/shared';
import { buildVacancyParseOutput } from '@jobflow/shared/testing';
import { useQuery } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applicationQueryOptions } from '@/entities/application';
import { errorReply, recordSentRequests, validationReply } from '@/test/api-handlers';
import {
  applicationRoute,
  checkFieldOf,
  confirmRoute,
  REVIEW_DRAFT,
  SALARY_IN_TEXT,
  updateRoute,
} from '@/test/application-fixtures';
import type { MoveRouteOptions } from '@/test/board-fixtures';
import { doubleClickWhileHeld } from '@/test/double-click-while-held';
import { descriptionOf } from '@/test/field-description';
import { latch } from '@/test/latch';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { DraftReview } from './draft-review';

vi.mock('next/link', () => import('@/test/link'));

type ReviewSetup = {
  application?: ApplicationResponse;
  update?: MoveRouteOptions;
  confirm?: MoveRouteOptions;
};

const CONFIRM = 'Підтвердити і на дошку';

const SAVE_FAILED_TOAST = 'Це збій на нашому боці, збережені дані на місці. Спробуй ще раз.';

const COMPANY_ERROR = 'Вкажи компанію одним коротким рядком';

const NO_QUOTE = 'Цитати в тексті вакансії не знайшлося';

function DetailReader({ application }: Readonly<{ application: ApplicationResponse }>) {
  useQuery(applicationQueryOptions(application.id));
  return null;
}

function renderReview({ application = REVIEW_DRAFT, update = {}, confirm = {} }: ReviewSetup = {}) {
  const detail = applicationRoute({ application });
  const updates = updateRoute({ application, ...update });
  const confirms = confirmRoute(confirm);
  server.use(detail.handler, updates.handler, confirms.handler);
  const onConfirmed = vi.fn<() => void>();
  const requests = recordSentRequests();
  const user = renderInApp(
    <>
      <DetailReader application={application} />
      <DraftReview application={application} actions={{ onConfirmed }} />
    </>,
  );
  const confirmUntilReported = async () => {
    await user.click(screen.getByRole('button', { name: CONFIRM }));
    await waitFor(() => {
      expect(onConfirmed).toHaveBeenCalledTimes(1);
    });
  };
  return {
    user,
    onConfirmed,
    confirmUntilReported,
    detailReads: detail.sent,
    updates: updates.sent,
    confirms: confirms.sent,
    writes: () => requests().flatMap(({ method }) => (method === 'GET' ? [] : [method])),
  };
}

function chip(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

function companyField(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Компанія' });
}

async function tooltipOf(name: string): Promise<string | null> {
  act(() => {
    chip(name).focus();
  });
  return (await screen.findByRole('tooltip')).textContent;
}

describe('DraftReview', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('an exact field carries точно, a doubted one перевір with the yellow control and its quote in the note, a missing one no chip', () => {
    renderReview();

    expect(chip('Компанія: точно').textContent).toBe('точно');
    expect(chip('Позиція: точно').textContent).toBe('точно');
    expect(chip('Вилка: перевір').textContent).toBe('перевір');
    expect(chip('Стек: точно').textContent).toBe('точно');
    expect(screen.queryByRole('button', { name: /^Джерело:/ })).toBeNull();
    expect(
      screen.getByRole('textbox', { name: 'Зарплата від' }).closest('[data-confidence="check"]'),
    ).not.toBeNull();
    expect(companyField().closest('[data-confidence="check"]')).toBeNull();
    expect(
      screen.getByText('Вилка: у тексті написано «from 4700 to 5900 net».', { exact: true }),
    ).toBeDefined();
    expect(screen.getByRole('group', { name: 'Вилка, USD' })).toBeDefined();
    expect(screen.getByText('Стек · розпізнано 1 із тексту')).toBeDefined();
  });

  it('a chip under keyboard focus shows the words the vacancy text holds, line break and spaces kept', async () => {
    renderReview();

    expect(await tooltipOf('Вилка: перевір')).toBe(SALARY_IN_TEXT);
  });

  it('a chip keeps its small look and takes a finger through the 44 px touch area', () => {
    renderReview();

    expect(chip('Компанія: точно').classList.contains('touch-target')).toBe(true);
    expect(chip('Вилка: перевір').classList.contains('touch-target')).toBe(true);
  });

  it('the quote opens beside the chip, so the panel heading above it stays readable', async () => {
    renderReview();
    act(() => {
      chip('Компанія: точно').focus();
    });

    const tooltip = await screen.findByRole('tooltip');

    expect(tooltip.closest('[data-side]')?.getAttribute('data-side')).toBe('right');
  });

  it('a doubted field whose quote the text does not hold says so in the chip and in the note', async () => {
    const aiParsed = buildVacancyParseOutput({ company: checkFieldOf('Acme', 'Globex GmbH') });
    renderReview({ application: { ...REVIEW_DRAFT, aiParsed } });

    expect(screen.getByText('Компанія: цитати в тексті вакансії не знайшлося.')).toBeDefined();
    expect(await tooltipOf('Компанія: перевір')).toBe(NO_QUOTE);
  });

  it('an unchanged form sends only the confirmation and reports it', async () => {
    const { confirmUntilReported, confirms, writes } = renderReview();

    await confirmUntilReported();

    expect(writes()).toEqual(['POST']);
    expect(confirms).toEqual([REVIEW_DRAFT.id]);
  });

  it('an edited company is saved first and confirmed after', async () => {
    const { user, confirmUntilReported, updates, writes } = renderReview();
    await user.clear(companyField());
    await user.type(companyField(), 'Acme Labs');

    await confirmUntilReported();

    expect(writes()).toEqual(['PATCH', 'POST']);
    expect(updates).toEqual([{ company: 'Acme Labs' }]);
  });

  it('a picked source alone is saved before the confirmation', async () => {
    const { user, confirmUntilReported, updates } = renderReview();
    await user.click(screen.getByRole('combobox', { name: 'Джерело' }));
    await user.click(screen.getByRole('option', { name: 'Work.ua' }));

    await confirmUntilReported();

    expect(updates).toEqual([{ source: 'workua' }]);
  });

  it('a draft somebody already confirmed reads the card again and shows no error toast', async () => {
    const { user, onConfirmed, detailReads } = renderReview({
      confirm: { reply: () => errorReply({ status: 409, type: 'conflict' }) },
    });
    await waitFor(() => {
      expect(detailReads).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: CONFIRM }));

    await waitFor(() => {
      expect(detailReads).toHaveLength(2);
    });
    expect(screen.queryByText(SAVE_FAILED_TOAST)).toBeNull();
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it('a 422 on the company shows under that field and nothing is confirmed', async () => {
    const { user, onConfirmed, confirms } = renderReview({
      update: {
        reply: () => validationReply([{ path: 'company', message: 'company is too long' }]),
      },
    });

    await user.type(companyField(), ' Labs');
    await user.click(screen.getByRole('button', { name: CONFIRM }));

    await waitFor(() => {
      expect(descriptionOf(companyField())).toBe(COMPANY_ERROR);
    });
    expect(confirms).toEqual([]);
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it('a double click while the confirmation is on its way sends it once', async () => {
    const held = latch();
    const { user, onConfirmed, confirms } = renderReview({ confirm: { latch: held } });

    await doubleClickWhileHeld({
      user,
      held,
      click: CONFIRM,
      sent: confirms,
      disabledWhileHeld: [CONFIRM],
    });

    await waitFor(() => {
      expect(onConfirmed).toHaveBeenCalledTimes(1);
    });
    expect(confirms).toEqual([REVIEW_DRAFT.id]);
  });

  it('Відкрити повну картку leads to the card page', () => {
    renderReview();

    expect(screen.getByRole('link', { name: 'Відкрити повну картку' }).getAttribute('href')).toBe(
      `/applications/${REVIEW_DRAFT.id}`,
    );
  });
});
