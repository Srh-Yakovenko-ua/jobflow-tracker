import type { ApplicationResponse } from '@jobflow/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OUTAGES } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { DESIGN_NORMS, NORMS_URL, normsRoute } from '@/test/norms-fixtures';
import { pinClockInEachTest } from '@/test/pinned-clock';
import { renderApplicationPage } from '@/test/render-application-page';
import { server } from '@/test/server';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const NOW = new Date('2026-11-15T09:00:00.000Z');

const FINAL_APPLICATION: ApplicationResponse = {
  ...ACME_APPLICATION,
  currentStage: 'final',
  daysInStage: 13,
};

async function contextRows(): Promise<[string | null, string | null][]> {
  const section = await screen.findByRole('region', { name: 'Контекст' });
  const values = within(section).getAllByRole('definition');
  return within(section)
    .getAllByRole('term')
    .map((term, at) => [term.textContent, values[at]?.textContent ?? null]);
}

describe('ApplicationContext', () => {
  pinClockInEachTest(NOW);

  it('reads the source and the days in the funnel, and says мало даних where no norm is known yet', async () => {
    renderApplicationPage();

    expect(await contextRows()).toEqual([
      ['джерело', 'Djinni'],
      ['у воронці', '26 днів'],
      ['твоя медіана до офера', 'мало даних'],
      ['на етапі', '9 днів · мало даних'],
    ]);
  });

  it('reads the median to offer and the stage norm from the fetched norms: 13 днів · норма 17', async () => {
    server.use(normsRoute(DESIGN_NORMS));
    renderApplicationPage({ application: FINAL_APPLICATION });

    await waitFor(async () => {
      expect((await contextRows()).slice(2)).toEqual([
        ['твоя медіана до офера', '37 днів'],
        ['на етапі', '13 днів · норма 17'],
      ]);
    });
  });

  it.each(OUTAGES)('while the norms request $name the rows say мало даних', async (outage) => {
    const asked: string[] = [];
    server.use(
      normsRoute((info) => {
        asked.push(info.request.url);
        return outage.reply(info);
      }),
    );
    renderApplicationPage({ application: FINAL_APPLICATION });
    await waitFor(() => {
      expect(asked).toContain(NORMS_URL);
    });

    expect((await contextRows()).slice(2)).toEqual([
      ['твоя медіана до офера', 'мало даних'],
      ['на етапі', '13 днів · мало даних'],
    ]);
  });

  it('a rejected application has no row for days on the stage', async () => {
    renderApplicationPage({ application: { ...ACME_APPLICATION, currentStage: 'rejected' } });

    const labels = (await contextRows()).map(([label]) => label);

    expect(labels).toEqual(['джерело', 'у воронці', 'твоя медіана до офера']);
  });
});
