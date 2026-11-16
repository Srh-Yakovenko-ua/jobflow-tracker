import type { BoardCard, FollowupResponse } from '@jobflow/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { rateLimitedReply } from '@/test/api-handlers';
import { ghostIn } from '@/test/board-fixtures';
import {
  acceptedFollowup,
  DESIGN_FOLLOWUP,
  followupJob,
  followupRoutes,
  READY_FOLLOWUP,
} from '@/test/followup-fixtures';
import { jobRoute, PROCESSING_JOB } from '@/test/job-fixtures';
import { latch } from '@/test/latch';
import { renderViewInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { useBulkFollowups } from '../model/use-bulk-followups';
import { BulkFollowupSheet } from './bulk-followup-sheet';

const [FIRST, SECOND, THIRD] = [
  ghostIn({ serial: 201, days: 10 }),
  ghostIn({ serial: 202, days: 20 }),
  ghostIn({ serial: 203, days: 30 }),
];

const GHOSTS: readonly BoardCard[] = [FIRST, SECOND, THIRD];

const BUDGET_COPY =
  'Ліміт AI на сьогодні вичерпано, тож цей лист пишеш сам. Твої дані нікуди не зникли.';

const RATE_LIMITED_COPY =
  'Забагато запитів до AI за короткий час. Спробуй трохи пізніше. Твої дані нікуди не зникли.';

const AFTER_ONE_POLL = { timeout: 3500 } as const;

type SheetSetup = Readonly<{
  afterPost: (id: string) => FollowupResponse;
  held?: ReturnType<typeof latch>;
  limitedId?: string;
}>;

function BulkHarness() {
  const queue = useBulkFollowups();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          queue.start(GHOSTS);
        }}
      >
        start
      </button>
      {queue.rows.length > 0 && <BulkFollowupSheet queue={queue} onClose={() => undefined} />}
    </>
  );
}

afterEach(() => {
  sessionStorage.clear();
});

async function renderSheet({ afterPost, held, limitedId }: SheetSetup) {
  const answered = new Map<string, FollowupResponse>();
  const routes = followupRoutes({
    responseOf: (id) => answered.get(id),
    generateReply: async ({ params }) => {
      if (answered.size === 0) await held?.reached;
      if (params.id === limitedId) return rateLimitedReply({ 'Retry-After': '60' });
      answered.set(params.id, afterPost(params.id));
      return acceptedFollowup();
    },
  });
  server.use(...routes.handlers, jobRoute({ job: () => PROCESSING_JOB }).handler);
  const { user } = renderViewInApp(<BulkHarness />);
  await user.click(screen.getByRole('button', { name: 'start' }));
  const rowOf = (card: BoardCard) =>
    screen.getByRole('listitem', { name: `${card.company} · ${card.position}` });
  return { user, sent: routes.sent, answered, rowOf };
}

describe('BulkFollowupSheet', () => {
  it('rows wait in the queue, then process, then show an editable draft that copies, and a skipped row is never posted', async () => {
    const held = latch();
    const { user, sent, answered, rowOf } = await renderSheet({
      afterPost: () => followupJob('processing'),
      held,
    });

    expect(within(rowOf(FIRST)).getByText('наступний у черзі')).toBeDefined();
    expect(within(rowOf(SECOND)).getByText('у черзі · 1 драфт перед цим')).toBeDefined();
    await user.click(within(rowOf(THIRD)).getByRole('button', { name: 'Пропустити' }));
    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });
    held.release();

    expect(await within(rowOf(FIRST)).findByText('крок 2 з 3 · обробляється')).toBeDefined();
    answered.set(FIRST.id, READY_FOLLOWUP);
    const ready = await within(rowOf(FIRST)).findByText(
      'драфт готовий · можна правити',
      {},
      AFTER_ONE_POLL,
    );
    expect(ready).toBeDefined();
    await user.click(within(rowOf(FIRST)).getByRole('button', { name: 'Скопіювати' }));

    expect(await navigator.clipboard.readText()).toBe(
      `${DESIGN_FOLLOWUP.subject}\n\n${DESIGN_FOLLOWUP.body}`,
    );
    expect(sent.posted.map((request) => request.id)).toEqual([FIRST.id, SECOND.id]);
    expect(sent.marked).toEqual([]);
  });

  it('rows whose jobs failed on the daily budget open the own text with the budget line and no retry', async () => {
    const { rowOf } = await renderSheet({
      afterPost: (id) =>
        id === FIRST.id ? READY_FOLLOWUP : followupJob('failed', 'budget_exceeded'),
    });

    expect(await within(rowOf(FIRST)).findByText('драфт готовий · можна правити')).toBeDefined();
    for (const card of [SECOND, THIRD]) {
      const row = rowOf(card);
      expect((await within(row).findByRole('alert')).textContent).toContain(BUDGET_COPY);
      expect(within(row).getByText('свій текст · пиши тут')).toBeDefined();
      expect(within(row).queryByRole('button', { name: 'Спробувати ще' })).toBeNull();
    }
  });

  it('rows the queue stopped on a 429 say to try later, not that the daily limit is spent, and keep the retry', async () => {
    const { rowOf } = await renderSheet({ afterPost: () => READY_FOLLOWUP, limitedId: SECOND.id });

    for (const card of [SECOND, THIRD]) {
      const row = rowOf(card);
      expect((await within(row).findByRole('alert')).textContent).toContain(RATE_LIMITED_COPY);
      expect(row.textContent).not.toContain(BUDGET_COPY);
      expect(within(row).getByRole('button', { name: 'Спробувати ще' })).toBeDefined();
      expect(within(row).getByRole('button', { name: 'Написати самому' })).toBeDefined();
    }
  });
});
