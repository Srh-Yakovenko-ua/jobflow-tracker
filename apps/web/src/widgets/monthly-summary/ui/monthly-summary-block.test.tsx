import type { SummaryResponse } from '@jobflow/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ANY_IDEMPOTENCY_KEY } from '@/test/api-handlers';
import { jobRoute, PROCESSING_JOB } from '@/test/job-fixtures';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';
import {
  DESIGN_SUMMARY,
  NO_SUMMARY,
  READY_SUMMARY,
  REGENERATED_JOB_ID,
  summaryRoutes,
} from '@/test/summary-fixtures';

import { MonthlySummaryBlock } from './monthly-summary-block';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const GENERATING = 'AI пише саммарі';

function renderBlock(latest: SummaryResponse) {
  const summaries = summaryRoutes({ latest });
  const jobs = jobRoute({ job: () => PROCESSING_JOB });
  server.use(meRoute(), ...summaries.handlers, jobs.handler);
  return { user: renderInApp(<MonthlySummaryBlock />), sent: summaries.sent };
}

describe('MonthlySummaryBlock', () => {
  it('with no summary yet says when it comes and generates one on request', async () => {
    const { user, sent } = renderBlock(NO_SUMMARY);

    expect(
      await screen.findByRole('heading', { name: 'Саммарі прийде першого числа' }),
    ).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Згенерувати зараз' }));

    expect(await screen.findByText(GENERATING)).toBeDefined();
    expect(sent.requests).toEqual([ANY_IDEMPOTENCY_KEY]);
  });

  it('while the job runs shows the label, three calm skeleton lines and the closable note', async () => {
    renderBlock({ summary: null, job: { id: REGENERATED_JOB_ID, status: 'processing' } });

    const status = (await screen.findByText(GENERATING)).closest<HTMLElement>('[role="status"]');
    if (status === null) throw new Error('no status panel around the label');
    expect(await within(status).findByText('~20 с · можна закрити сторінку')).toBeDefined();
    expect(status.querySelectorAll('[aria-hidden] > span.rounded-\\[7px\\]')).toHaveLength(3);
  });

  it('a failed job newer than the summary offers a retry and keeps the last summary below', async () => {
    const { user, sent } = renderBlock({
      summary: DESIGN_SUMMARY,
      job: { id: REGENERATED_JOB_ID, status: 'failed' },
    });

    expect(await screen.findByText('AI не впорався')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Як пройшов серпень' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));

    expect(await screen.findByText(GENERATING)).toBeDefined();
    expect(sent.requests).toHaveLength(1);
  });

  it('a ready summary shows the dark block with both actions', async () => {
    renderBlock(READY_SUMMARY);

    const heading = await screen.findByRole('heading', { level: 3, name: 'Як пройшов серпень' });
    expect(heading.closest('[data-theme="dark"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Зберегти як план' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Перегенерувати' })).toBeDefined();
  });
});
