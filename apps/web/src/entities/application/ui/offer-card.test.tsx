import type { ApplicationCard as ApplicationCardData } from '@jobflow/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ApplicationCardContext } from '../model/card-context';
import { FULL_CARD } from '../model/card-specimens';
import { ApplicationCard } from './application-card';

const OFFER_CARD: ApplicationCardData = {
  ...FULL_CARD,
  company: 'Lumen Labs',
  position: 'Frontend Engineer',
  currentStage: 'offer',
  salaryMin: 5800,
  salaryMax: 5800,
  appliedAt: '2026-09-19T09:00:00.000Z',
};

const CONTEXT: ApplicationCardContext = {
  now: new Date('2026-10-30T09:00:00.000Z'),
  timeZone: 'Europe/Kyiv',
};

describe('ApplicationCard in the offer column', () => {
  it('shows the solid офер badge where the Match Score sits, the salary in offer green and the days in the funnel', () => {
    render(<ApplicationCard application={OFFER_CARD} context={CONTEXT} />);

    expect(screen.getByText('офер').className).toContain('bg-offer');
    expect(screen.queryByRole('img', { name: 'Match Score 84' })).toBeNull();
    expect(screen.getByText('$5 800').className).toContain('text-offer');
    expect(screen.getByText('41 день у воронці')).toBeDefined();
  });

  it('leaves the days line out when the application has no applied date', () => {
    render(<ApplicationCard application={{ ...OFFER_CARD, appliedAt: null }} context={CONTEXT} />);

    expect(screen.getByText('офер')).toBeDefined();
    expect(screen.queryByText(/у воронці/)).toBeNull();
  });

  it('keeps the Match Score and no офер badge on a card in an open stage', () => {
    render(<ApplicationCard application={FULL_CARD} context={CONTEXT} />);

    expect(screen.getByRole('img', { name: 'Match Score 84' })).toBeDefined();
    expect(screen.queryByText('офер')).toBeNull();
  });
});
