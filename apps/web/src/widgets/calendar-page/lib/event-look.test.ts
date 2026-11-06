import { type Stage, STAGES } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { EVENT_LOOK, FOLLOWUP_LOOK } from './event-look';

const TOKEN_OF: Record<Stage, string> = {
  applied: 'var(--color-stage-applied)',
  screening: 'var(--color-stage-screening)',
  tech_interview: 'var(--color-stage-tech)',
  final: 'var(--color-stage-final)',
  offer: 'var(--color-offer)',
  rejected: 'var(--color-ghosted)',
  ghosted: 'var(--color-ghosted)',
  withdrawn: 'var(--color-ghosted)',
};

const RAW_COLOUR = /oklch\(|#[0-9a-f]{3,8}\b|rgb\(/i;

describe('EVENT_LOOK', () => {
  it.each(STAGES)('tints a %s event with its stage token over the surface, in ink', (stage) => {
    const { color, contrastColor } = EVENT_LOOK[stage];

    expect(color.startsWith(`color-mix(in oklab, ${TOKEN_OF[stage]} `)).toBe(true);
    expect(color.endsWith('%, var(--color-surface))')).toBe(true);
    expect(color).not.toMatch(RAW_COLOUR);
    expect(contrastColor).toBe('var(--color-ink)');
  });

  it('draws a follow-up in the accent tint with accent ink, apart from every stage', () => {
    expect(FOLLOWUP_LOOK).toEqual({
      color: 'var(--color-accent-tint)',
      contrastColor: 'var(--color-accent-ink)',
    });
    expect(Object.values(EVENT_LOOK).map(({ color }) => color)).not.toContain(FOLLOWUP_LOOK.color);
  });
});
