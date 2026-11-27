import { LIVE_LIMITS } from '@jobflow/shared';
import { buildJobStatus } from '@jobflow/shared/testing';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { advanceBy } from '@/test/advance-timers';
import { cvHintsJob, READY_CV_HINTS } from '@/test/cv-hints-fixtures';
import { fakeTimeoutsAndIntervals } from '@/test/fake-timeouts';
import { jobRoute } from '@/test/job-fixtures';
import {
  DESIGN_MATCH,
  DESIGN_VERSION,
  DESIGN_VERSIONS,
  MATCH_NOW,
  MATCHED_APPLICATION,
  NO_MATCH,
  scoredMatch,
} from '@/test/match-fixtures';
import { renderApplicationPage } from '@/test/render-application-page';
import { server } from '@/test/server';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const TITLE = 'Як підсилити резюме під цю вакансію';

const RESUMES = { items: [...DESIGN_VERSIONS] };

describe('ApplicationCvHints', () => {
  it('a score below 100 gets the hints section right under the breakdown, before the history', async () => {
    renderApplicationPage({
      application: MATCHED_APPLICATION,
      match: DESIGN_MATCH,
      cvHints: READY_CV_HINTS,
      resumes: RESUMES,
    });

    const section = await screen.findByRole('region', { name: TITLE });
    const match = screen.getByRole('region', { name: 'Match Score 78%' });
    const history = screen.getByRole('region', { name: 'Історія відгуку' });

    expect(await within(section).findByText('GraphQL')).toBeDefined();
    expect(match.compareDocumentPosition(section)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(section.compareDocumentPosition(history)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('a full score of 100 has nothing to tailor and shows no hints section', async () => {
    const { cvHints } = renderApplicationPage({
      application: MATCHED_APPLICATION,
      match: scoredMatch({
        version: DESIGN_VERSION,
        score: 100,
        computedAt: MATCH_NOW.toISOString(),
      }),
      resumes: RESUMES,
    });

    await screen.findByRole('region', { name: 'Match Score 100%' });

    expect(screen.queryByRole('region', { name: TITLE })).toBeNull();
    expect(cvHints.requested).toEqual([]);
  });

  it('with no Match Score there is no hints section', async () => {
    renderApplicationPage({ application: MATCHED_APPLICATION, match: NO_MATCH, resumes: RESUMES });

    await screen.findByText(/Match Score не пораховано/);

    expect(screen.queryByRole('region', { name: TITLE })).toBeNull();
  });

  it('queued hints keep asking until they are done, then show the rows', async () => {
    fakeTimeoutsAndIntervals();
    server.use(jobRoute({ job: () => buildJobStatus() }).handler);
    const page = renderApplicationPage({
      application: MATCHED_APPLICATION,
      match: DESIGN_MATCH,
      cvHints: cvHintsJob('queued'),
      resumes: RESUMES,
    });
    const section = await screen.findByRole('region', { name: TITLE });
    expect(await within(section).findByText(/у черзі · 2 задачі перед твоєю/)).toBeDefined();

    page.cvHints.answer(READY_CV_HINTS);
    await advanceBy(LIVE_LIMITS.pollFallbackMs);

    expect(await within(section).findByText('GraphQL')).toBeDefined();
  });
});
