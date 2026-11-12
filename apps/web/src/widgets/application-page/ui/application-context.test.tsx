import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ACME_APPLICATION } from '@/test/application-fixtures';
import { pinClockInEachTest } from '@/test/pinned-clock';
import { renderApplicationPage } from '@/test/render-application-page';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const NOW = new Date('2026-11-15T09:00:00.000Z');

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

  it('a rejected application has no row for days on the stage', async () => {
    renderApplicationPage({ application: { ...ACME_APPLICATION, currentStage: 'rejected' } });

    const labels = (await contextRows()).map(([label]) => label);

    expect(labels).toEqual(['джерело', 'у воронці', 'твоя медіана до офера']);
  });
});
