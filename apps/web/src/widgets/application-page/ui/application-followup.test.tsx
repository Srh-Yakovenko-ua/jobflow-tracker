import { buildJobStatus } from '@jobflow/shared/testing';
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ACME_APPLICATION, REVIEW_DRAFT } from '@/test/application-fixtures';
import { DESIGN_FOLLOWUP, followupJob, READY_FOLLOWUP } from '@/test/followup-fixtures';
import { jobRoute } from '@/test/job-fixtures';
import { renderApplicationPage } from '@/test/render-application-page';
import { server } from '@/test/server';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

afterEach(() => {
  window.location.hash = '';
});

describe('ApplicationFollowup', () => {
  it('an active application shows the follow-up with its days of silence above the recruiter', async () => {
    renderApplicationPage({ followup: READY_FOLLOWUP });

    const section = await screen.findByRole('region', { name: 'Фоллоу-ап' });
    const recruiter = screen.getByRole('region', { name: 'Рекрутер' });

    expect(await within(section).findByText('4 дні тиші')).toBeDefined();
    expect(within(section).getByRole('button', { name: 'Ще варіант' })).toBeDefined();
    expect(section.compareDocumentPosition(recruiter)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('in the single-column sheet the follow-up comes right after the stage buttons, before the history', async () => {
    renderApplicationPage({ mode: 'sheet', followup: READY_FOLLOWUP });

    const section = await screen.findByRole('region', { name: 'Фоллоу-ап' });
    const stageButton = screen.getByRole('button', { name: 'Перенести у «фінал»' });
    const history = screen.getByRole('region', { name: 'Історія відгуку' });

    expect(stageButton.compareDocumentPosition(section)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(section.compareDocumentPosition(history)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('on the full page below the wide layout the follow-up sits before the notes in tab order', async () => {
    renderApplicationPage({ followup: READY_FOLLOWUP });

    const section = await screen.findByRole('region', { name: 'Фоллоу-ап' });
    const notes = screen.getByRole('region', { name: 'Нотатки' });
    const history = screen.getByRole('region', { name: 'Історія відгуку' });

    expect(section.compareDocumentPosition(notes)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(section.compareDocumentPosition(history)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it.each([
    { name: 'a draft', application: REVIEW_DRAFT },
    {
      name: 'a rejected application',
      application: { ...ACME_APPLICATION, currentStage: 'rejected' as const },
    },
  ])('$name has no follow-up', async ({ application }) => {
    renderApplicationPage({ application });

    await screen.findByRole('region', { name: 'Рекрутер' });

    expect(screen.queryByRole('region', { name: 'Фоллоу-ап' })).toBeNull();
  });

  it('closing the card while the draft is queued and opening it again shows the ready draft', async () => {
    server.use(jobRoute({ job: () => buildJobStatus() }).handler);
    const { followup, reopen } = renderApplicationPage({
      mode: 'sheet',
      followup: followupJob('queued'),
    });
    const section = await screen.findByRole('region', { name: 'Фоллоу-ап' });
    expect(await within(section).findByText(/у черзі · 2 задачі перед твоєю/)).toBeDefined();

    followup.answer(READY_FOLLOWUP);
    reopen();

    const reopened = await screen.findByRole('region', { name: 'Фоллоу-ап' });
    expect(await within(reopened).findByText('драфт готовий · можна правити')).toBeDefined();
    expect(
      within(reopened).getByRole<HTMLTextAreaElement>('textbox', { name: 'Текст листа' }).value,
    ).toBe(DESIGN_FOLLOWUP.body);
  });

  it('arriving on #follow-up brings the follow-up into view from its top', async () => {
    window.location.hash = '#follow-up';
    const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView');
    renderApplicationPage({ followup: READY_FOLLOWUP });

    const section = await screen.findByRole('region', { name: 'Фоллоу-ап' });

    expect(section.id).toBe('follow-up');
    expect(scrolled).toHaveBeenCalledWith({ block: 'start' });
    expect(scrolled.mock.contexts).toContain(section);
  });
});
