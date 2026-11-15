import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { READY_INTERVIEW_PREP } from '@/test/interview-prep-fixtures';
import { pinClockInEachTest } from '@/test/pinned-clock';
import { renderApplicationPage } from '@/test/render-application-page';
import { scheduledEventOf } from '@/test/scheduled-event-fixtures';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const TITLE = 'Підготовка до співбесіди';

const PLANNED_TOMORROW = scheduledEventOf({ startsAt: '2026-11-15T09:00:00.000Z' });

const PAST_PLANNED = scheduledEventOf({ startsAt: '2026-11-12T09:00:00.000Z' });

const CANCELLED_TOMORROW = scheduledEventOf({
  id: '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1e02',
  startsAt: '2026-11-15T12:00:00.000Z',
  status: 'cancelled',
});

describe('ApplicationInterviewPrep', () => {
  pinClockInEachTest(new Date('2026-11-14T10:00:00.000Z'));

  it('a planned interview ahead gets the prep section before the history, with the ready pack', async () => {
    renderApplicationPage({
      scheduledEvents: { items: [PLANNED_TOMORROW] },
      interviewPrep: READY_INTERVIEW_PREP,
    });

    const section = await screen.findByRole('region', { name: TITLE });
    const history = screen.getByRole('region', { name: 'Історія відгуку' });

    expect(await within(section).findByRole('list', { name: 'Ймовірні теми' })).toBeDefined();
    expect(section.compareDocumentPosition(history)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('with only a past interview and a cancelled one there is nothing to prepare for and no section', async () => {
    renderApplicationPage({
      scheduledEvents: { items: [PAST_PLANNED, CANCELLED_TOMORROW] },
      interviewPrep: READY_INTERVIEW_PREP,
    });

    await screen.findByRole('region', { name: 'Як пройшло?' });

    expect(screen.queryByRole('region', { name: TITLE })).toBeNull();
  });
});
