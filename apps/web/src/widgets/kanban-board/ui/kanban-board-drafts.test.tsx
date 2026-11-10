import type { BoardCard } from '@jobflow/shared';
import { buildJobStatus } from '@jobflow/shared/testing';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, recordSentRequests } from '@/test/api-handlers';
import { startDrag } from '@/test/board-drag';
import { cardIn, fixtureIdOf } from '@/test/board-fixtures';
import { advanceBy as wait, fakeTimeoutsAndIntervals } from '@/test/fake-timeouts';
import { JOB_ID, jobRoute } from '@/test/job-fixtures';
import { latch } from '@/test/latch';
import { bringLiveStreamUp as openStream, closeLiveStreams } from '@/test/live-stream';
import { boardReadyToDrag, columnNamed, renderBoard } from '@/test/render-board';
import { server } from '@/test/server';

vi.mock('next/link', () => import('@/test/link'));
vi.mock('next/navigation', () => import('@/test/navigation'));

const BOARD_URL = apiUrl('/applications/board');

const PROCESSING_LINE = 'AI обробляє · крок 2 з 3';

type Parse = Pick<BoardCard, 'aiStatus' | 'aiJobId'>;

const PROCESSING: Parse = { aiStatus: 'processing', aiJobId: JOB_ID };

function draftIn(serial: number, parse: Parse): BoardCard {
  const position = `Draft ${String(serial)}`;
  return { ...cardIn({ serial, stage: 'applied', position }), isDraft: true, ...parse };
}

function oneDraftBoard(parse: Parse) {
  return { counts: { applied: 1 }, cards: [draftIn(301, parse)] };
}

function boardRequestsOf(sentRequests: ReturnType<typeof recordSentRequests>) {
  return () =>
    sentRequests().filter(({ url }) => typeof url === 'string' && url.startsWith(BOARD_URL));
}

afterEach(() => {
  closeLiveStreams();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('KanbanBoard drafts', () => {
  it('a queued draft in відгук shows its wait from the job route', async () => {
    const jobs = jobRoute({ job: () => buildJobStatus({ queue: { ahead: 3, etaSeconds: 120 } }) });
    server.use(jobs.handler);
    renderBoard(oneDraftBoard({ aiStatus: 'queued', aiJobId: JOB_ID }));

    const line = await screen.findByText('у черзі · ~2 хв');

    expect(columnNamed('відгук 1').contains(line)).toBe(true);
    expect(jobs.sent).toEqual([JOB_ID]);
  });

  it('a processing draft shows step 2 of 3 with none of its fields, and opens its own page', async () => {
    renderBoard(oneDraftBoard(PROCESSING));

    const link = (await screen.findByText(PROCESSING_LINE)).closest('a');

    expect(screen.queryByText('Draft 301')).toBeNull();
    expect(link?.getAttribute('href')).toBe(`/applications/${fixtureIdOf(301)}`);
    expect(link?.dataset.scroll).toBe('false');
  });

  it('with the stream down the board asks again after 2 s, turns the parsed draft into a перевір поля card that opens the review, and stops asking', async () => {
    fakeTimeoutsAndIntervals();
    const parse = { done: false };
    const boardRequests = boardRequestsOf(recordSentRequests());
    renderBoard({
      ...oneDraftBoard(PROCESSING),
      liveCard: (card) => (parse.done ? { ...card, aiStatus: 'done' } : card),
    });
    await screen.findByText(PROCESSING_LINE);

    parse.done = true;
    await wait(2000);
    const link = (await screen.findByText('перевір поля')).closest('a');

    expect(screen.getByText('Draft 301')).toBeDefined();
    expect(link?.getAttribute('href')).toBe(`/add?review=${fixtureIdOf(301)}#review`);
    expect(link?.dataset.scroll).toBe('true');
    await wait(30_000);
    expect(boardRequests()).toHaveLength(2);
  });

  it('with the stream up the board asks again only after 10 s', async () => {
    fakeTimeoutsAndIntervals();
    await openStream();
    const boardRequests = boardRequestsOf(recordSentRequests());
    renderBoard(oneDraftBoard(PROCESSING));
    await screen.findByText(PROCESSING_LINE);

    await wait(8000);
    expect(boardRequests()).toHaveLength(1);
    await wait(2000);

    await waitFor(() => {
      expect(boardRequests()).toHaveLength(2);
    });
  });

  it('a draft whose parse failed shows потрібні поля with the kept text line and opens the failure flow with its job', async () => {
    renderBoard(oneDraftBoard({ aiStatus: 'failed', aiJobId: JOB_ID }));

    const link = (await screen.findByText('потрібні поля')).closest('a');

    expect(screen.getByText('текст збережено в нотатці')).toBeDefined();
    expect(screen.getByText('Draft 301')).toBeDefined();
    expect(screen.queryByText('перевір поля')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Match Score не пораховано' })).toBeNull();
    expect(link?.getAttribute('href')).toBe(`/add?review=${fixtureIdOf(301)}&job=${JOB_ID}#review`);
    expect(link?.dataset.scroll).toBe('true');
  });

  it.each([
    { aiStatus: 'done', mark: 'перевір поля' },
    { aiStatus: 'failed', mark: 'потрібні поля' },
  ] as const)(
    'a board whose only draft is $aiStatus is asked once and never on a timer',
    async ({ aiStatus, mark }) => {
      fakeTimeoutsAndIntervals();
      const boardRequests = boardRequestsOf(recordSentRequests());
      renderBoard(oneDraftBoard({ aiStatus, aiJobId: JOB_ID }));
      await screen.findByText(mark);

      await wait(30_000);

      expect(boardRequests()).toHaveLength(1);
    },
  );

  it('while a move is on its way the board is never asked on its timer, and the timer comes back once the move lands', async () => {
    fakeTimeoutsAndIntervals();
    const held = latch();
    const boardRequests = boardRequestsOf(recordSentRequests());
    const moved = cardIn({ serial: 302, stage: 'applied', position: 'Senior Frontend Engineer' });
    const { moves } = await boardReadyToDrag({
      board: { counts: { applied: 2 }, cards: [draftIn(301, PROCESSING), moved] },
      move: { latch: held },
    });

    const drag = startDrag(screen.getByText('Senior Frontend Engineer'));
    drag.over(columnNamed('скринінг 0'));
    drag.drop();
    await waitFor(() => {
      expect(moves).toEqual([{ fromStage: 'applied', toStage: 'screening' }]);
    });
    const asked = boardRequests().length;
    await wait(6500);

    expect(boardRequests()).toHaveLength(asked);
    held.release();
    await waitFor(() => {
      expect(boardRequests()).toHaveLength(asked + 1);
    });
    await wait(2000);
    await waitFor(() => {
      expect(boardRequests()).toHaveLength(asked + 2);
    });
  });

  it('three parsing drafts are counted in one status region, and each link is named by its place among them', async () => {
    const cards = [501, 502, 503].map((serial) => draftIn(serial, PROCESSING));
    renderBoard({ counts: { applied: 3 }, cards });
    await screen.findAllByText(PROCESSING_LINE);

    const regions = document.querySelectorAll('[role="status"]:not([aria-live="assertive"])');
    const hrefOf = (name: string) => screen.getByRole('link', { name }).getAttribute('href');

    expect(regions).toHaveLength(1);
    expect(regions[0]?.textContent).toBe('AI розбирає 3 чернетки');
    expect(hrefOf(`Чернетка 1. ${PROCESSING_LINE}`)).toBe(`/applications/${fixtureIdOf(501)}`);
    expect(hrefOf(`Чернетка 2. ${PROCESSING_LINE}`)).toBe(`/applications/${fixtureIdOf(502)}`);
    expect(hrefOf(`Чернетка 3. ${PROCESSING_LINE}`)).toBe(`/applications/${fixtureIdOf(503)}`);
  });

  it('20 parsing drafts in відгук stand still: no bar shimmers and no dot pulses', async () => {
    const cards = Array.from({ length: 20 }, (_, slot) => draftIn(400 + slot, PROCESSING));
    renderBoard({ counts: { applied: 20 }, cards });

    expect(await screen.findAllByText(PROCESSING_LINE)).toHaveLength(20);

    const applied = columnNamed('відгук 20');
    expect(applied.querySelectorAll('[class*="animate-shimmer"]')).toHaveLength(0);
    expect(applied.querySelectorAll('.motion-safe\\:animate-pulse')).toHaveLength(0);
  });
});
