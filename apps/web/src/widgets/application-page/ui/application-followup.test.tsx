import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ACME_APPLICATION, REVIEW_DRAFT } from '@/test/application-fixtures';
import { READY_FOLLOWUP } from '@/test/followup-fixtures';
import { renderApplicationPage } from '@/test/render-application-page';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

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
});
