import type { ResumeVersion } from '@jobflow/shared';
import { screen, within } from '@testing-library/react';
import { http } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, errorReply } from '@/test/api-handlers';
import { advancePastQueryRetries, fakeTimeoutsAndClock } from '@/test/fake-timeouts';
import { renderInApp } from '@/test/render-in-app';
import {
  buildResumeVersion,
  buildResumeVersions,
  resumeRoutes,
  type ResumeRoutesOptions,
} from '@/test/resume-fixtures';
import { server } from '@/test/server';

import { ResumesPage } from './resumes-page';

vi.mock('next/navigation', () => import('@/test/navigation'));

const TABLE = { name: 'Версії резюме' } as const;

const ACTIVE = 'активна';

const LONG_TITLE = 'для продуктових компаній з акцентом на дизайн-системи та B2B SaaS';

function renderPage(options: ResumeRoutesOptions = {}) {
  const routes = resumeRoutes(options);
  server.use(...routes.handlers);
  const user = renderInApp(<ResumesPage />);
  return { user, routes };
}

async function dataRowsOf(name: string) {
  const table = await screen.findByRole('table', { name });
  return within(table).getAllByRole('row').slice(1);
}

function rowOf(rows: readonly HTMLElement[], label: string): HTMLElement {
  const row = rows.find((candidate) => within(candidate).queryByText(label) !== null);
  if (row === undefined) throw new Error(`no row for ${label}`);
  return row;
}

function onlyVersion(overrides: Partial<ResumeVersion>): ResumeRoutesOptions {
  return { items: [buildResumeVersion(overrides)] };
}

beforeEach(() => {
  fakeTimeoutsAndClock();
  vi.setSystemTime(new Date('2026-11-11T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ResumesPage', () => {
  it('no versions turn the table into the first-upload empty state with the file picker', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Завантаж перше резюме' })).toBeDefined();
    expect(screen.getByLabelText('Обрати файл')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Завантажити версію' })).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('three versions list the active one first with the badge, then the rest newest first', async () => {
    const versions = buildResumeVersions(3);
    renderPage({ items: versions, activeId: versions[1]?.id ?? null });

    const rows = await dataRowsOf(TABLE.name);

    expect(rows.map((row) => within(row).getByTitle(/^CV v/).textContent)).toEqual([
      'CV v2 · версія 2',
      'CV v3 · версія 3',
      'CV v1 · версія 1',
    ]);
    expect(within(rowOf(rows, 'CV v2 · версія 2')).getByText(ACTIVE)).toBeDefined();
    expect(screen.getAllByText(ACTIVE)).toHaveLength(1);
  });

  it('twenty versions show five rows and fold fifteen into a closed archive that opens on click', async () => {
    const versions = buildResumeVersions(20);
    const { user } = renderPage({ items: versions, activeId: versions[0]?.id ?? null });

    expect(await dataRowsOf(TABLE.name)).toHaveLength(5);
    const archive = screen.getByRole('button', { name: 'архів · 15' });
    expect(archive.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('table', { name: 'архів · 15' })).toBeNull();
    await user.click(archive);

    expect(await dataRowsOf('архів · 15')).toHaveLength(15);
    expect(archive.getAttribute('aria-expanded')).toBe('true');
  });

  it('a version with four applications shows how many are missing and no percent anywhere', async () => {
    renderPage(onlyVersion({ applicationsCount: 4 }));

    const [row] = await dataRowsOf(TABLE.name);
    if (row === undefined) throw new Error('one row expected');

    expect(within(row).getByText('потрібно ще 1')).toBeDefined();
    expect(within(row).getByText('мало даних')).toBeDefined();
    expect(within(row).getByText('4')).toBeDefined();
    expect(screen.getByRole('table', TABLE).textContent).not.toContain('%');
  });

  it('a long version name is cut on its line while the date and the size stay', async () => {
    renderPage(onlyVersion({ title: LONG_TITLE }));

    const [row] = await dataRowsOf(TABLE.name);
    if (row === undefined) throw new Error('one row expected');
    const name = within(row).getByTitle(`CV v1 · ${LONG_TITLE}`);

    expect(name.className).toContain('truncate');
    expect(name.className).toContain('min-w-0');
    expect(within(row).getByText('09.08')).toBeDefined();
    expect(within(row).getByText('214 КБ')).toBeDefined();
  });

  it.each<{ status: ResumeVersion['aiProfileStatus']; label: string }>([
    { status: 'queued', label: 'у черзі' },
    { status: 'failed', label: 'потрібен текстовий PDF' },
  ])('an AI profile that is $status reads "$label" in the row', async ({ status, label }) => {
    renderPage(onlyVersion({ aiProfileStatus: status }));

    const [row] = await dataRowsOf(TABLE.name);
    if (row === undefined) throw new Error('one row expected');

    expect(within(row).getByText(label)).toBeDefined();
  });

  it('a list that fails shows the load error, and the retry brings the table back', async () => {
    const outage = { on: true };
    const routes = resumeRoutes({ items: buildResumeVersions(1) });
    server.use(
      http.get(apiUrl('/resumes/versions'), () =>
        outage.on ? errorReply({ status: 500, type: 'internal_error' }) : undefined,
      ),
      ...routes.handlers,
    );
    const user = renderInApp(<ResumesPage />);
    await advancePastQueryRetries();

    const retry = await screen.findByRole('button', { name: 'Спробувати ще раз' });
    outage.on = false;
    await user.click(retry);

    expect(await dataRowsOf(TABLE.name)).toHaveLength(1);
  });
});
