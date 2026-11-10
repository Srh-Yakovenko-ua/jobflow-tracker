import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AddQuery } from '@/features/add-application';
import { addRoutes } from '@/test/add-fixtures';
import { recordSentRequests } from '@/test/api-handlers';
import { axeViolations } from '@/test/axe';
import { captureTokenRoutes } from '@/test/capture-token-fixtures';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import { AddApplicationPage } from './add-application-page';

const MARKUP = '<b>Senior QA</b> <img src=x onerror=alert(1)> Kvit шукає тестувальника';

const HEADINGS = [
  'Один клік зі сторінки вакансії',
  'Вставити опис вакансії',
  'Заповнити самому',
  'Обробка йде у фоні',
];

const MANUAL_NOTE =
  "Обов'язкові тільки компанія і позиція. Match Score у такої картки не буде, і це нормально.";

async function renderPage(query: AddQuery = {}) {
  const added = addRoutes();
  server.use(meRoute(), ...captureTokenRoutes().handlers, ...added.handlers);
  const sentRequests = recordSentRequests();
  renderInApp(<AddApplicationPage query={query} />);
  await screen.findByRole('button', { name: 'Створити кнопку' });
  return { sentRequests, sent: added.sent };
}

function textField() {
  return screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Текст вакансії' });
}

function linkField() {
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Посилання на вакансію' });
}

describe('AddApplicationPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers the bookmarklet, the paste form and the manual form under one heading', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Три способи додати відгук');
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(HEADINGS);
    expect(screen.getByText(MANUAL_NOTE)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Розібрати текст' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Створити картку' })).toBeDefined();
    expect(document.activeElement).toBe(document.body);
  });

  it('the bookmarklet fallback query fills the paste form as plain text and sends nothing', async () => {
    const { sentRequests, sent } = await renderPage({
      text: MARKUP,
      url: 'https://djinni.co/jobs/1',
    });

    expect(textField().value).toBe(MARKUP);
    expect(linkField().value).toBe('https://djinni.co/jobs/1');
    expect(document.querySelector('b, img')).toBeNull();
    expect(document.activeElement).toBe(textField());
    expect(sentRequests().filter(({ method }) => method !== 'GET')).toEqual([]);
    expect(sent).toEqual({ pasted: [], created: [] });
  });

  it('a javascript: url in the query never reaches the link field', async () => {
    await renderPage({ text: 'Kvit шукає QA', url: 'javascript:alert(1)' });

    expect(textField().value).toBe('Kvit шукає QA');
    expect(linkField().value).toBe('');
  });

  it('path=paste puts the focus in the empty text field', async () => {
    await renderPage({ path: 'paste' });

    expect(textField().value).toBe('');
    expect(document.activeElement).toBe(textField());
  });

  it('has no accessibility violations', async () => {
    await renderPage({ path: 'paste' });

    expect(await axeViolations()).toEqual([]);
  });
});
