import type { TimelineItem } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { stageMoveOf, timelineItemOf } from '@/test/timeline-fixtures';

import { reviveTargetOf } from './revive-target';

function stageChanged(serial: number, meta: TimelineItem['meta']): TimelineItem {
  return timelineItemOf({
    serial,
    type: 'stage_changed',
    occurredAt: '2026-10-01T09:00:00Z',
    title: 'перенос',
    meta,
  });
}

const INTO_GHOSTED = stageChanged(
  2,
  stageMoveOf({ fromStage: 'screening', toStage: 'ghosted', daysInPreviousStage: 30 }),
);

const INTO_SCREENING = stageChanged(
  1,
  stageMoveOf({ fromStage: 'applied', toStage: 'screening', daysInPreviousStage: 4 }),
);

const FOLLOWUP_SENT = timelineItemOf({
  serial: 3,
  type: 'followup_sent',
  occurredAt: '2026-10-02T09:00:00Z',
  title: 'Фоллоу-ап надіслано',
  meta: {},
});

describe('reviveTargetOf', () => {
  it('a card that went screening → ghosted revives to screening', () => {
    expect(reviveTargetOf([FOLLOWUP_SENT, INTO_GHOSTED, INTO_SCREENING])).toBe('screening');
  });

  it('gives nothing when the newest stage move did not go into ghosted', () => {
    expect(reviveTargetOf([INTO_SCREENING, INTO_GHOSTED])).toBeNull();
  });

  it('gives nothing when the ghost move came from a stage that is not active', () => {
    const fromOffer = stageChanged(
      4,
      stageMoveOf({ fromStage: 'offer', toStage: 'ghosted', daysInPreviousStage: 3 }),
    );

    expect(reviveTargetOf([fromOffer])).toBeNull();
  });

  it('gives nothing for a ghost move whose fromStage is missing or unknown', () => {
    const broken = stageChanged(5, { toStage: 'ghosted', fromStage: 'hired' });
    const missing = stageChanged(6, { toStage: 'ghosted' });

    expect([reviveTargetOf([broken]), reviveTargetOf([missing])]).toEqual([null, null]);
  });

  it('gives nothing for a timeline with no stage moves', () => {
    expect(reviveTargetOf([FOLLOWUP_SENT])).toBeNull();
  });
});
