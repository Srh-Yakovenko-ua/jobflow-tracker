import type { ApplicationMatchResponse, Stage } from '@jobflow/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { NO_INTERVIEW_PREP, READY_INTERVIEW_PREP } from '@/test/interview-prep-fixtures';
import { DESIGN_MATCH, NO_MATCH } from '@/test/match-fixtures';
import { pinClockInEachTest } from '@/test/pinned-clock';
import { renderApplicationPage } from '@/test/render-application-page';
import {
  scheduledEventOf,
  type ScheduledEventRoutesOptions,
} from '@/test/scheduled-event-fixtures';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const TITLE = 'Підготовка';

const REQUEST = { name: 'Підготувати до співбесіди' } as const;

const NOTHING_TO_BUILD_FROM =
  'Для підготовки потрібна запланована співбесіда і вимоги або Match Score у вакансії.';

const PLANNED_TOMORROW = scheduledEventOf({ startsAt: '2026-11-15T09:00:00.000Z' });

const PAST_PLANNED = scheduledEventOf({ startsAt: '2026-11-12T09:00:00.000Z' });

const CANCELLED_TOMORROW = scheduledEventOf({
  id: '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1e02',
  startsAt: '2026-11-15T12:00:00.000Z',
  status: 'cancelled',
});

function renderAt(
  currentStage: Stage,
  scheduledEvents: ScheduledEventRoutesOptions = { items: [CANCELLED_TOMORROW] },
) {
  renderApplicationPage({
    application: { ...ACME_APPLICATION, currentStage },
    scheduledEvents,
    interviewPrep: NO_INTERVIEW_PREP,
  });
}

function renderBareVacancy(match: ApplicationMatchResponse) {
  renderApplicationPage({
    application: { ...ACME_APPLICATION, stack: [], aiParsed: null },
    scheduledEvents: { items: [PLANNED_TOMORROW] },
    match,
    interviewPrep: NO_INTERVIEW_PREP,
  });
  return screen.findByRole('region', { name: TITLE });
}

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

  it('at screening with no interview planned shows the section, says what the pack needs and offers no button', async () => {
    renderAt('screening');

    const section = await screen.findByRole('region', { name: TITLE });

    expect(await within(section).findByText(NOTHING_TO_BUILD_FROM)).toBeDefined();
    expect(within(section).queryByRole('button', REQUEST)).toBeNull();
  });

  it('a planned interview for a vacancy with no stack, requirements or Match Score gaps says what the pack needs and offers no button', async () => {
    const section = await renderBareVacancy(NO_MATCH);

    expect(await within(section).findByText(NOTHING_TO_BUILD_FROM)).toBeDefined();
    expect(within(section).queryByRole('button', REQUEST)).toBeNull();
  });

  it('a planned interview for a vacancy with Match Score gaps offers the button', async () => {
    const section = await renderBareVacancy(DESIGN_MATCH);

    expect(await within(section).findByRole('button', REQUEST)).toBeDefined();
  });

  it('at applied with an interview planned ahead shows the section with the button', async () => {
    renderAt('applied', { items: [PLANNED_TOMORROW] });

    const section = await screen.findByRole('region', { name: TITLE });

    expect(await within(section).findByRole('button', REQUEST)).toBeDefined();
    expect(within(section).getByText(/Нотаток він не бачить/)).toBeDefined();
  });

  it('at screening with a schedule that fails to load offers the button, never says an interview is missing', async () => {
    renderAt('screening', {
      list: { reply: () => errorReply({ status: 404, type: 'not_found' }) },
    });

    const section = await screen.findByRole('region', { name: TITLE });

    expect(await within(section).findByRole('button', REQUEST)).toBeDefined();
    expect(within(section).queryByText(NOTHING_TO_BUILD_FROM)).toBeNull();
  });

  it.each(['applied', 'offer'] as const)(
    'at %s with only a past interview and a cancelled one there is nothing to prepare for and no section',
    async (stage) => {
      renderAt(stage, { items: [PAST_PLANNED, CANCELLED_TOMORROW] });

      await screen.findByRole('region', { name: 'Як пройшло?' });

      expect(screen.queryByRole('region', { name: TITLE })).toBeNull();
    },
  );
});
