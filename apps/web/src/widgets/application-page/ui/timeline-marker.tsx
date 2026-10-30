import { CircleDashed } from 'lucide-react';

import { StageMarker } from '@/entities/application';

import type { TimelineMarker as RowMarker } from '../lib/timeline-rows';

export type TimelineMarkerKind = RowMarker | { kind: 'waiting' };

export type TimelineMarkerProps = Readonly<{ marker: TimelineMarkerKind }>;

export function TimelineMarker({ marker }: TimelineMarkerProps) {
  switch (marker.kind) {
    case 'stage':
      return (
        <span className="mt-1.25 flex flex-none">
          <StageMarker stage={marker.stage} />
        </span>
      );
    case 'ring':
      return (
        <span className="mt-1.25 size-2.25 flex-none rounded-full bg-surface inset-ring-[1.5px] inset-ring-line" />
      );
    case 'waiting':
      return <span className="mt-1 size-2.75 flex-none rounded-full bg-accent" />;
    case 'silence':
      return (
        <CircleDashed aria-hidden size={16} strokeWidth={1.9} className="flex-none text-ghosted" />
      );
    default: {
      const unhandled: never = marker;
      throw new Error(`Unknown timeline marker ${JSON.stringify(unhandled)}`);
    }
  }
}
