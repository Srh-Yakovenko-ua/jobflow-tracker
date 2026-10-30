import type { Stage } from '@jobflow/shared';

import { cn } from '@/shared/lib/cn';

import { STAGE_COLOR_CLASS } from './stage-color';

export type StageMarkerProps = Readonly<{ stage: Stage }>;

type MarkerLook = { frame: string; mark?: string };

const SQUARE = 'size-2.25 rounded-[3px]';

const RING = 'flex size-2.5 items-center justify-center rounded-full inset-ring-2';

const BAR = 'h-0.5 rounded-[1px]';

const MARKER_LOOK: Record<Stage, MarkerLook> = {
  applied: { frame: cn(SQUARE, STAGE_COLOR_CLASS.applied) },
  screening: { frame: cn(SQUARE, STAGE_COLOR_CLASS.screening) },
  tech_interview: { frame: cn(SQUARE, STAGE_COLOR_CLASS.tech_interview) },
  final: { frame: cn(SQUARE, STAGE_COLOR_CLASS.final) },
  offer: { frame: 'size-2.5 rounded-full bg-offer' },
  rejected: { frame: cn(RING, 'inset-ring-rejected'), mark: cn(BAR, 'w-1.25 bg-rejected') },
  ghosted: { frame: 'size-2.5 rounded-full border-2 border-dashed border-ghosted' },
  withdrawn: {
    frame: cn(RING, 'inset-ring-withdrawn'),
    mark: cn(BAR, 'w-1.75 -rotate-45 bg-withdrawn'),
  },
};

export function StageMarker({ stage }: StageMarkerProps) {
  const look = MARKER_LOOK[stage];
  return (
    <span aria-hidden className={cn('flex-none', look.frame)}>
      {look.mark !== undefined && <span className={cn('block', look.mark)} />}
    </span>
  );
}
