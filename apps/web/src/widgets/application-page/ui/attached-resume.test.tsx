import { LIVE_EVENTS, LIVE_LIMITS } from '@jobflow/shared';
import { buildJobUpdate } from '@jobflow/shared/testing';
import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { applicationRoute } from '@/test/application-fixtures';
import { advanceBy, fakeTimeoutsAndIntervals } from '@/test/fake-timeouts';
import { latch } from '@/test/latch';
import { bringLiveStreamUp } from '@/test/live-stream';
import {
  DESIGN_MATCH,
  DESIGN_VERSIONS,
  MATCH_JOB_ID,
  MATCH_NOW,
  MATCHED_APPLICATION,
  matchJob,
  NEXT_VERSION,
  NO_MATCH,
  queuedMatchJobRoute,
  scoredMatch,
} from '@/test/match-fixtures';
import { pinClockInEachTest } from '@/test/pinned-clock';
import { type ApplicationPageSetup, renderApplicationPage } from '@/test/render-application-page';
import { server } from '@/test/server';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const EVENT_IDS = {
  job: '0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f2a',
  application: '0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f2b',
} as const;

const RELINKED = { ...MATCHED_APPLICATION, resumeVersionId: NEXT_VERSION.id };

const KICKER = { name: "Прив'язане резюме" } as const;

type ShownPage = ReturnType<typeof renderApplicationPage>;

async function pageWithStream(setup: ApplicationPageSetup) {
  const shown: { page: ShownPage | null } = { page: null };
  const source = await bringLiveStreamUp(() => {
    shown.page = renderApplicationPage({ ...setup, live: true });
  });
  if (shown.page === null) throw new Error('the page renders before the stream opens');
  return { ...shown.page, source };
}

async function pickVersion(page: Pick<ShownPage, 'user'>, name: RegExp): Promise<void> {
  const section = await screen.findByRole('region', KICKER);
  await page.user.click(within(section).getByRole('button', { name: 'Змінити версію' }));
  await page.user.click(await screen.findByRole('menuitemradio', { name }));
}

describe('AttachedResume', () => {
  pinClockInEachTest(MATCH_NOW);

  it('reads the linked version as the design draws it', async () => {
    renderApplicationPage({
      application: MATCHED_APPLICATION,
      match: DESIGN_MATCH,
      resumes: { items: [...DESIGN_VERSIONS] },
    });

    const section = await screen.findByRole('region', KICKER);

    expect(await within(section).findByText('CV v2 · акцент на продукті')).toBeDefined();
    expect(within(section).getByText(/завантажено 09\.08 · 27 відгуків/)).toBeDefined();
    expect(within(section).getByText('мало даних')).toBeDefined();
    expect(within(section).getByRole('button', { name: 'Переглянути PDF' })).toBeDefined();
  });

  it('relinking to another version queues a new score and the live stream brings it in', async () => {
    const held = latch();
    const page = await pageWithStream({
      application: MATCHED_APPLICATION,
      match: DESIGN_MATCH,
      resumes: { items: [...DESIGN_VERSIONS], relink: { latch: held } },
    });
    await screen.findByRole('region', { name: 'Збіг 78%' });

    await pickVersion(page, /CV v3/);
    await waitFor(() => {
      expect(page.resumes.relinked).toEqual([
        { applicationId: MATCHED_APPLICATION.id, resumeVersionId: NEXT_VERSION.id },
      ]);
    });
    server.use(applicationRoute({ application: RELINKED }).handler, queuedMatchJobRoute());
    page.match.answer(matchJob('queued'));
    held.release();

    expect(await screen.findByText(/у черзі · 1 задача перед твоєю/)).toBeDefined();

    page.match.answer(
      scoredMatch({ version: NEXT_VERSION, score: 85, computedAt: '2026-11-15T08:59:00.000Z' }),
    );
    act(() => {
      page.source.send({
        id: EVENT_IDS.job,
        type: LIVE_EVENTS.jobUpdated,
        data: buildJobUpdate({
          id: MATCH_JOB_ID,
          status: 'done',
          applicationId: MATCHED_APPLICATION.id,
        }),
      });
      page.source.send({
        id: EVENT_IDS.application,
        type: LIVE_EVENTS.applicationUpdated,
        data: { applicationId: MATCHED_APPLICATION.id, fields: ['matchScore'] },
      });
    });

    const scored = await screen.findByRole('region', { name: 'Збіг 85%' });
    expect(within(scored).getByText(/проти CV v3/)).toBeDefined();
  });

  it('between the relink and the new job the score shows as being counted', async () => {
    const page = renderApplicationPage({
      application: MATCHED_APPLICATION,
      match: DESIGN_MATCH,
      resumes: { items: [...DESIGN_VERSIONS] },
    });
    await screen.findByRole('region', { name: 'Збіг 78%' });
    server.use(applicationRoute({ application: RELINKED }).handler);
    page.match.answer(NO_MATCH);

    await pickVersion(page, /CV v3/);

    expect(await screen.findByText(/обробляється/)).toBeDefined();
  });

  it('a relink on a draft stops asking for the score, since a draft gets no match job', async () => {
    fakeTimeoutsAndIntervals();
    const draft = { ...MATCHED_APPLICATION, isDraft: true };
    const page = renderApplicationPage({
      application: draft,
      match: NO_MATCH,
      resumes: { items: [...DESIGN_VERSIONS] },
    });
    const section = await screen.findByRole('region', KICKER);
    server.use(
      applicationRoute({ application: { ...draft, resumeVersionId: NEXT_VERSION.id } }).handler,
    );

    await pickVersion(page, /CV v3/);
    expect(await within(section).findByText('CV v3 · для дизайн-ролей')).toBeDefined();
    await advanceBy(LIVE_LIMITS.pollFallbackMs);
    const asked = page.match.sent.length;
    await advanceBy(LIVE_LIMITS.pollFallbackMs * 3);

    expect(page.resumes.relinked).toEqual([
      { applicationId: MATCHED_APPLICATION.id, resumeVersionId: NEXT_VERSION.id },
    ]);
    expect(page.match.sent).toHaveLength(asked);
  });

  it('with no CV linked offers the versions to pick from', async () => {
    const page = renderApplicationPage({ resumes: { items: [...DESIGN_VERSIONS] } });

    const section = await screen.findByRole('region', KICKER);

    expect(
      await within(section).findByText("До цього відгуку резюме не прив'язане."),
    ).toBeDefined();
    await pickVersion(page, /CV v2/);
    await waitFor(() => {
      expect(page.resumes.relinked).toHaveLength(1);
    });
  });

  it('with no CV uploaded at all links to the resumes page', async () => {
    renderApplicationPage({ resumes: { items: [] } });

    const section = await screen.findByRole('region', KICKER);
    const upload = await within(section).findByRole('link', { name: 'Завантажити резюме' });

    expect(upload.getAttribute('href')).toBe('/resumes');
  });
});
