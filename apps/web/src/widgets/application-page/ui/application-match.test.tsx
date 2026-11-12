import { LIVE_LIMITS } from '@jobflow/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { advanceBy, fakeTimeoutsAndIntervals } from '@/test/fake-timeouts';
import {
  DESIGN_EXPLANATION,
  DESIGN_MATCH,
  DESIGN_VERSION,
  DESIGN_VERSIONS,
  MATCH_NOW,
  MATCHED_APPLICATION,
  matchJob,
  NO_MATCH,
  queuedMatchJobRoute,
} from '@/test/match-fixtures';
import { pinClockInEachTest } from '@/test/pinned-clock';
import { renderApplicationPage } from '@/test/render-application-page';
import { resumeRoutes } from '@/test/resume-fixtures';
import { server } from '@/test/server';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

function rowsOf(list: string): (string | null)[] {
  const shown = screen.getByRole('list', { name: list });
  return within(shown)
    .getAllByRole('listitem')
    .map(({ textContent }) => textContent);
}

async function matchSection(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: /^Збіг/ });
}

describe('ApplicationMatch', () => {
  pinClockInEachTest(MATCH_NOW);

  it('reads the design breakdown: the score, the version it was counted against, both lists and the explanation', async () => {
    renderApplicationPage({
      application: MATCHED_APPLICATION,
      match: DESIGN_MATCH,
      resumes: { items: [...DESIGN_VERSIONS] },
    });

    const section = await screen.findByRole('region', { name: 'Збіг 78%' });

    expect(within(section).getByText('Розбір Match Score')).toBeDefined();
    expect(within(section).getByText('проти CV v2 · 14.08')).toBeDefined();
    expect(rowsOf('Що збіглося')).toEqual([
      'React + TypeScript, 6 роківповний',
      'Node.js у продіповний',
      'GraphQLчастковий',
      'Рівень англійської Upper-Intповний',
    ]);
    expect(rowsOf('Чого не вистачає')).toEqual([
      'AWS / інфраструктура−14',
      'Досвід ліда команди 3+−8',
      'Домен fintechне вплинуло',
    ]);
    expect(within(section).getByText('Домен fintech').className).toContain('text-ink-3');
    expect(within(section).getByText('AWS / інфраструктура').className).not.toContain('text-ink-3');
    expect(within(section).getByText(DESIGN_EXPLANATION)).toBeDefined();
  });

  it('without a CV shows the dashed score and a link to upload one', async () => {
    renderApplicationPage({ match: NO_MATCH });

    const section = await matchSection();

    expect(await within(section).findByRole('img', { name: 'без CV' })).toBeDefined();
    expect(within(section).getByText(/Рахувати нема з чим/)).toBeDefined();
    const link = within(section).getByRole('link', { name: 'завантаж резюме' });

    expect(link.getAttribute('href')).toBe('/resumes');
  });

  it('while the score is counted shows the queue line and marks the section busy', async () => {
    server.use(queuedMatchJobRoute());
    renderApplicationPage({ application: MATCHED_APPLICATION, match: matchJob('queued') });

    const section = await matchSection();

    expect(await within(section).findByText(/у черзі · 1 задача перед твоєю/)).toBeDefined();
    expect(section.getAttribute('aria-busy')).toBe('true');
  });

  it('the counted score replaces the queue line without both showing at once', async () => {
    fakeTimeoutsAndIntervals();
    server.use(queuedMatchJobRoute());
    const page = renderApplicationPage({
      application: MATCHED_APPLICATION,
      match: matchJob('queued'),
      resumes: { items: [...DESIGN_VERSIONS] },
    });
    const section = await matchSection();
    await within(section).findByText(/1 задача перед твоєю/);
    const overlaps: string[] = [];
    const watch = new MutationObserver(() => {
      const shown = section.textContent;
      if (shown.includes('задача перед твоєю') && shown.includes(DESIGN_EXPLANATION)) {
        overlaps.push(shown);
      }
    });
    watch.observe(section, { childList: true, subtree: true, characterData: true });

    page.match.answer(DESIGN_MATCH);
    await advanceBy(LIVE_LIMITS.pollFallbackMs);

    expect(await within(section).findByText(DESIGN_EXPLANATION)).toBeDefined();
    watch.disconnect();
    expect(overlaps).toEqual([]);
  });

  it('a failed score says so and offers nothing to press', async () => {
    renderApplicationPage({ application: MATCHED_APPLICATION, match: matchJob('failed') });

    const section = await matchSection();

    expect(await within(section).findByText('AI не впорався')).toBeDefined();
    expect(within(section).queryByRole('button')).toBeNull();
  });

  it('a CV whose AI profile fails while the score waits on it stops waiting and stops asking', async () => {
    fakeTimeoutsAndIntervals();
    const page = renderApplicationPage({
      application: MATCHED_APPLICATION,
      match: NO_MATCH,
      resumes: { items: [{ ...DESIGN_VERSION, aiProfileStatus: 'processing' }] },
    });
    const section = await matchSection();
    expect(await within(section).findByText(/обробляється/)).toBeDefined();

    server.use(
      ...resumeRoutes({ items: [{ ...DESIGN_VERSION, aiProfileStatus: 'failed' }] }).handlers,
    );
    await advanceBy(LIVE_LIMITS.pollFallbackMs);

    expect(await within(section).findByText(/Score не порахований/)).toBeDefined();
    const asked = page.match.sent.length;
    await advanceBy(LIVE_LIMITS.pollFallbackMs * 3);
    expect(page.match.sent).toHaveLength(asked);
  });

  it('a read CV with no score explains why the score is missing', async () => {
    renderApplicationPage({
      application: MATCHED_APPLICATION,
      match: NO_MATCH,
      resumes: { items: [...DESIGN_VERSIONS] },
    });

    const section = await matchSection();

    expect(await within(section).findByText(/Score не порахований/)).toBeDefined();
  });
});
