import type { ImportApplicationsResponse } from '@jobflow/shared';
import { screen, within } from '@testing-library/react';
import { HttpResponse } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { importRoute } from '@/test/account-fixtures';
import { ANY_IDEMPOTENCY_KEY, errorReply } from '@/test/api-handlers';
import { stubFileDownload } from '@/test/file-download';
import { pinClockInEachTest } from '@/test/pinned-clock';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import { ImportWizard } from './import-wizard';

vi.mock('next/link', () => import('@/test/link'));

pinClockInEachTest(new Date('2026-11-14T10:00:00.000Z'));

const SHEET = [
  'Компанія;Посада;Дата відгуку;Етап;Нотатка',
  'Vela;Frontend Engineer;2026-10-01;скринінг;перша',
  ';QA Engineer;02.10.2026;;',
  'Acme;Backend;2026-10-03;;',
].join('\r\n');

const IMPORTED: ImportApplicationsResponse = {
  imported: 2,
  errors: [
    { row: 1, path: 'company', message: 'Too small: expected string to have >=1 characters' },
  ],
};

function csvFile(text: string, name = 'tracker.csv') {
  return new File([text], name, { type: 'text/csv' });
}

async function uploaded(file: File, reply = () => HttpResponse.json(IMPORTED)) {
  const route = importRoute(reply);
  server.use(meRoute({ timezone: 'Europe/Kyiv' }), route.handler);
  const user = renderInApp(<ImportWizard />);
  await user.upload(screen.getByLabelText('Обрати файл'), file);
  return { user, sent: route.sent };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ImportWizard', () => {
  it('maps the columns it recognises, previews the rows with their errors and imports every row', async () => {
    const { user, sent } = await uploaded(csvFile(SHEET));

    expect(await screen.findByRole('heading', { name: 'Зістав стовпці' })).toBeDefined();
    expect(screen.getByText('Крок 2 з 3')).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'Компанія' }).textContent).toBe('Компанія');
    expect(screen.getByRole('combobox', { name: 'Етап' }).textContent).toBe('Етап');
    expect(screen.getByRole('combobox', { name: 'Зарплата' }).textContent).toBe('Не імпортувати');

    await user.click(screen.getByRole('button', { name: 'Перевірити рядки' }));

    const table = within(await screen.findByRole('table', { name: 'Перші рядки файлу' }));
    expect(table.getAllByRole('row')).toHaveLength(4);
    expect(table.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Рядок',
      'Перевірка',
      'Компанія',
      'Посада',
      'Дата відгуку',
      'Етап',
    ]);
    expect(table.getByRole('row', { name: /^3 / }).textContent).toContain(
      'Компанія: вкажи назву одним коротким рядком',
    );
    expect(table.getByRole('row', { name: /^2 / }).textContent).toContain('Готовий');
    expect(
      screen.getByText('Показано 3 з 3 рядків, з помилками 1. Рядки з помилками не імпортуються.'),
    ).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Імпортувати 2 з 3 рядків' }));

    expect(await screen.findByRole('heading', { name: 'Імпортовано 2 відгуки' })).toBeDefined();
    expect(screen.getByText('Не імпортовано: 1 рядок')).toBeDefined();
    expect(screen.getByRole('listitem').textContent).toBe(
      'Рядок 3 · Компанія: вкажи назву одним коротким рядком',
    );
    expect(sent).toEqual([
      {
        idempotencyKey: ANY_IDEMPOTENCY_KEY,
        body: {
          rows: [
            {
              company: 'Vela',
              position: 'Frontend Engineer',
              appliedAt: '2026-09-30T21:00:00.000Z',
              stage: 'screening',
            },
            { position: 'QA Engineer', appliedAt: '2026-10-01T21:00:00.000Z' },
            { company: 'Acme', position: 'Backend', appliedAt: '2026-10-02T21:00:00.000Z' },
          ],
        },
      },
    ]);
  });

  it('a required field with no column says so and stays on the mapping', async () => {
    const { user } = await uploaded(csvFile('Компанія;Посада\r\nVela;Frontend\r\n'));
    await screen.findByRole('heading', { name: 'Зістав стовпці' });

    await user.click(screen.getByRole('button', { name: 'Перевірити рядки' }));

    expect(
      screen.getByRole('combobox', { name: 'Дата відгуку' }).getAttribute('aria-invalid'),
    ).toBe('true');
    expect(screen.getByText('Обери стовпець для цього поля')).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('refuses a file that is not a CSV and stays on the upload', async () => {
    await uploaded(csvFile('a;b', 'tracker.xlsx'));

    expect(
      await screen.findByText('Це не CSV. Збережи таблицю як CSV і обери файл ще раз.'),
    ).toBeDefined();
    expect(screen.getByText('Крок 1 з 3')).toBeDefined();
  });

  it('no active search says so and keeps the preview for another try', async () => {
    const { user } = await uploaded(csvFile(SHEET), () =>
      errorReply({ status: 409, type: 'conflict', detail: 'No active search' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Перевірити рядки' }));

    await user.click(await screen.findByRole('button', { name: 'Імпортувати 2 з 3 рядків' }));

    expect(await screen.findByText('Немає активного пошуку')).toBeDefined();
    expect(screen.getByRole('table', { name: 'Перші рядки файлу' })).toBeDefined();
  });

  it('a future applied date says so apart from a format error, in the preview and the result', async () => {
    const sheet =
      'Компанія;Посада;Дата відгуку\r\nVela;Frontend;2026-12-01\r\nAcme;QA;31.09.2026\r\n';
    const { user } = await uploaded(csvFile(sheet));
    await user.click(await screen.findByRole('button', { name: 'Перевірити рядки' }));

    const table = within(await screen.findByRole('table', { name: 'Перші рядки файлу' }));
    expect(table.getByRole('row', { name: /^2 / }).textContent).toContain(
      'Дата не може бути в майбутньому',
    );
    const unreadable = table.getByRole('row', { name: /^3 / }).textContent;
    expect(unreadable).toContain('Дата відгуку: формат 2026-10-01 або 01.10.2026');
    expect(unreadable).not.toContain('Дата не може бути в майбутньому');
    const submit = screen.getByRole('button', { name: 'Імпортувати 0 з 2 рядків' });
    expect(submit.hasAttribute('disabled')).toBe(true);
  });

  it('lists a future date the server refused with its own message', async () => {
    const sheet = 'Компанія;Посада;Дата відгуку\r\nVela;Frontend;2026-10-01\r\n';
    const { user } = await uploaded(csvFile(sheet), () =>
      HttpResponse.json({
        imported: 0,
        errors: [{ row: 0, path: 'appliedAt', message: 'The date must not be in the future' }],
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Перевірити рядки' }));

    await user.click(await screen.findByRole('button', { name: 'Імпортувати 1 рядок' }));

    expect(await screen.findByText('Рядок 2 · Дата не може бути в майбутньому')).toBeDefined();
  });

  it('saves the CSV template from the browser', async () => {
    const download = stubFileDownload();
    server.use(meRoute());
    const user = renderInApp(<ImportWizard />);

    await user.click(screen.getByRole('button', { name: 'Завантажити шаблон CSV' }));

    expect(download.anchors()).toEqual([
      { href: 'blob:http://localhost/jobflow-download', download: 'jobflow-import-template.csv' },
    ]);
    const [blob] = download.blobs();
    expect(blob?.type).toBe('text/csv;charset=utf-8');
    expect((await blob?.text())?.replace(/^\uFEFF/u, '').split('\r\n')[0]).toBe(
      'company;position;source;applied_at;stage;salary;url;stage_history',
    );
  });
});
