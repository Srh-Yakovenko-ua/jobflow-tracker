import type { ResumeAbResponse, ResumeVersion } from '@jobflow/shared';
import { screen, within } from '@testing-library/react';
import type { HttpResponseResolver } from 'msw';
import { http } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, errorReply } from '@/test/api-handlers';
import { advancePastQueryRetries, fakeTimeoutsAndClock } from '@/test/fake-timeouts';
import { renderInApp } from '@/test/render-in-app';
import { DESIGN_RESUME_AB, resumeAbRoute } from '@/test/resume-ab-fixtures';
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

type PageRoutesOptions = ResumeRoutesOptions & {
  resumeAb?: ResumeAbResponse | HttpResponseResolver;
};

const DESIGN_COUNTS: Record<number, number> = { 3: 3, 2: 27, 1: 21 };

function renderPage({ resumeAb, ...options }: PageRoutesOptions = {}) {
  const routes = resumeRoutes(options);
  server.use(resumeAbRoute(resumeAb), ...routes.handlers);
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

function designPage(resumeAb: ResumeAbResponse | HttpResponseResolver): PageRoutesOptions {
  const items = buildResumeVersions(3).map((version) => ({
    ...version,
    applicationsCount: DESIGN_COUNTS[version.number] ?? 0,
  }));
  return { items, activeId: items[1]?.id ?? null, resumeAb };
}

function barOf(row: HTMLElement): Element | null {
  return row.querySelector('[data-conversion-bar]');
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
    { status: 'needs_text', label: 'потрібен текстовий PDF' },
    { status: 'failed', label: 'AI-профіль не вдався' },
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
      resumeAbRoute(),
      ...routes.handlers,
    );
    const user = renderInApp(<ResumesPage />);
    await advancePastQueryRetries();

    const retry = await screen.findByRole('button', { name: 'Спробувати ще раз' });
    outage.on = false;
    await user.click(retry);

    expect(await dataRowsOf(TABLE.name)).toHaveLength(1);
  });

  it('the design numbers show 41% with its bar on the active CV v2, 24% on CV v1 and too little data on CV v3', async () => {
    renderPage(designPage(DESIGN_RESUME_AB));

    await screen.findByText('41%');
    const rows = await dataRowsOf(TABLE.name);
    const v2 = rowOf(rows, 'CV v2 · версія 2');
    const v1 = rowOf(rows, 'CV v1 · версія 1');
    const v3 = rowOf(rows, 'CV v3 · версія 3');

    expect(within(v2).getByText('41%')).toBeDefined();
    expect(within(v1).getByText('24%')).toBeDefined();
    expect(barOf(v2)?.className).toContain('bg-data-2');
    expect(barOf(v2)?.getAttribute('style')).toContain('translateX(-59%)');
    expect(barOf(v1)?.className).toContain('bg-data-6');
    expect(barOf(v1)?.getAttribute('style')).toContain('translateX(-76%)');
    expect(within(v3).getByText('потрібно ще 2')).toBeDefined();
    expect(within(v3).getByText('мало даних')).toBeDefined();
    expect(barOf(v3)).toBeNull();
  });

  it('the rows other than the active one go by conversion, so CV v1 at 24% comes before the newer CV v3', async () => {
    renderPage(designPage(DESIGN_RESUME_AB));
    await screen.findByText('41%');

    const rows = await dataRowsOf(TABLE.name);

    expect(rows.map((row) => within(row).getByTitle(/^CV v/).textContent)).toEqual([
      'CV v2 · версія 2',
      'CV v1 · версія 1',
      'CV v3 · версія 3',
    ]);
  });

  it('an analytics outage keeps the table with the sample counts and no percent', async () => {
    renderPage(designPage(() => errorReply({ status: 503, type: 'dependency_unavailable' })));
    await advancePastQueryRetries();

    const rows = await dataRowsOf(TABLE.name);

    expect(within(rowOf(rows, 'CV v3 · версія 3')).getByText('потрібно ще 2')).toBeDefined();
    expect(screen.getAllByText('мало даних')).toHaveLength(3);
    expect(screen.getByRole('table', TABLE).textContent).not.toContain('%');
    expect(screen.queryByRole('button', { name: 'Спробувати ще раз' })).toBeNull();
  });
});
