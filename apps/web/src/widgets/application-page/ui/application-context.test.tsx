import type { ApplicationResponse } from '@jobflow/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NEVER_ANSWERS, OUTAGES } from '@/test/api-handlers';
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

const CONTEXT = { name: 'Контекст' } as const;

const RETRY = { name: 'Спробувати ще раз' } as const;

const RETRY_WAIT = { timeout: 2500 } as const;

const UNREAD_ROWS = [
  ['твоя медіана до офера', '—'],
  ['на етапі', '13 днів'],
];

async function contextRows(): Promise<[string | null, string | null][]> {
  const section = await screen.findByRole('region', CONTEXT);
  const values = within(section).getAllByRole('definition');
  return within(section)
    .getAllByRole('term')
    .map((term, at) => [term.textContent, values[at]?.textContent ?? null]);
}

describe('ApplicationContext', () => {
  pinClockInEachTest(NOW);

  it('reads the source and the days in the funnel, and says мало даних where no norm is known yet', async () => {
    renderApplicationPage();

    await waitFor(async () => {
      expect(await contextRows()).toEqual([
        ['джерело', 'Djinni'],
        ['у воронці', '26 днів'],
        ['твоя медіана до офера', 'мало даних'],
        ['на етапі', '9 днів · мало даних'],
      ]);
    });
  });

  it('reads the median to offer and the stage norm from the fetched norms: 13 днів · зазвичай 17 дн', async () => {
    server.use(normsRoute(DESIGN_NORMS));
    renderApplicationPage({ application: FINAL_APPLICATION });

    await waitFor(async () => {
      expect((await contextRows()).slice(2)).toEqual([
        ['твоя медіана до офера', '37 днів'],
        ['на етапі', '13 днів · зазвичай 17 дн'],
      ]);
    });
  });

  it.each(OUTAGES.filter(({ settled }) => settled === 'error'))(
    'when the norms request $name the rows show the neutral mark and a retry that reads them again',
    async (outage) => {
      const down = { on: true };
      server.use(
        normsRoute((info) => (down.on ? outage.reply(info) : Response.json(DESIGN_NORMS))),
      );
      const { user } = renderApplicationPage({ application: FINAL_APPLICATION });

      const section = await screen.findByRole('region', CONTEXT);
      const retry = await within(section).findByRole('button', RETRY, RETRY_WAIT);

      expect((await contextRows()).slice(2)).toEqual(UNREAD_ROWS);
      expect(within(section).queryByText(/мало даних/)).toBeNull();
      down.on = false;
      await user.click(retry);
      await waitFor(async () => {
        expect((await contextRows()).slice(2)).toEqual([
          ['твоя медіана до офера', '37 днів'],
          ['на етапі', '13 днів · зазвичай 17 дн'],
        ]);
      });
      expect(within(section).queryByRole('button', RETRY)).toBeNull();
    },
  );

  it('a failed norms read keeps its alert while the retry runs, with the retry button busy', async () => {
    const [outage] = OUTAGES.filter(({ settled }) => settled === 'error');
    if (outage === undefined) throw new Error('no failing outage to read the norms through');
    const held = { on: false };
    server.use(normsRoute((info) => (held.on ? NEVER_ANSWERS.reply(info) : outage.reply(info))));
    const { user } = renderApplicationPage({ application: FINAL_APPLICATION });

    const section = await screen.findByRole('region', CONTEXT);
    const retry = await within(section).findByRole('button', RETRY, RETRY_WAIT);
    held.on = true;
    await user.click(retry);

    expect(
      await within(section).findByRole('button', { ...RETRY, busy: true }, RETRY_WAIT),
    ).toBeDefined();
  });

  it('while the norms request never answers the rows show the neutral mark and no retry', async () => {
    const asked: string[] = [];
    server.use(
      normsRoute((info) => {
        asked.push(info.request.url);
        return NEVER_ANSWERS.reply(info);
      }),
    );
    renderApplicationPage({ application: FINAL_APPLICATION });
    await waitFor(() => {
      expect(asked).toContain(NORMS_URL);
    });

    expect((await contextRows()).slice(2)).toEqual(UNREAD_ROWS);
    expect(screen.queryByRole('button', RETRY)).toBeNull();
  });

  it('a rejected application has no row for days on the stage', async () => {
    renderApplicationPage({ application: { ...ACME_APPLICATION, currentStage: 'rejected' } });

    const labels = (await contextRows()).map(([label]) => label);

    expect(labels).toEqual(['джерело', 'у воронці', 'твоя медіана до офера']);
  });
});
