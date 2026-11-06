import type { Stage } from '@jobflow/shared';

export type EventLook = Readonly<{ color: string; contrastColor: string }>;

const INK = 'var(--color-ink)';

const ARCHIVE_LOOK: EventLook = {
  color: 'color-mix(in oklab, var(--color-ghosted) 30%, var(--color-surface))',
  contrastColor: INK,
};

export const EVENT_LOOK: Record<Stage, EventLook> = {
  applied: {
    color: 'color-mix(in oklab, var(--color-stage-applied) 12%, var(--color-surface))',
    contrastColor: INK,
  },
  screening: {
    color: 'color-mix(in oklab, var(--color-stage-screening) 14%, var(--color-surface))',
    contrastColor: INK,
  },
  tech_interview: {
    color: 'color-mix(in oklab, var(--color-stage-tech) 16%, var(--color-surface))',
    contrastColor: INK,
  },
  final: {
    color: 'color-mix(in oklab, var(--color-stage-final) 22%, var(--color-surface))',
    contrastColor: INK,
  },
  offer: {
    color: 'color-mix(in oklab, var(--color-offer) 14%, var(--color-surface))',
    contrastColor: INK,
  },
  rejected: ARCHIVE_LOOK,
  ghosted: ARCHIVE_LOOK,
  withdrawn: ARCHIVE_LOOK,
};

export const FOLLOWUP_LOOK: EventLook = {
  color: 'var(--color-accent-tint)',
  contrastColor: 'var(--color-accent-ink)',
};
