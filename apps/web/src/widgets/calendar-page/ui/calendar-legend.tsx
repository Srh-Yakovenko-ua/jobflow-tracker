import { AlarmClock, type LucideIcon } from 'lucide-react';

import { SCHEDULED_EVENT_ICON } from '@/entities/application';
import { uk } from '@/shared/i18n';

import { EVENT_LOOK, type EventLook, FOLLOWUP_LOOK } from '../lib/event-look';

const COPY = uk.calendarPage;

type LegendEntry = Readonly<{
  id: keyof typeof COPY.legend;
  look: EventLook;
  Icon?: LucideIcon;
}>;

const NEUTRAL_LOOK: EventLook = {
  color: 'var(--color-surface-3)',
  contrastColor: 'var(--color-ink-2)',
};

const LEGEND: readonly LegendEntry[] = [
  { id: 'interview', look: NEUTRAL_LOOK, Icon: SCHEDULED_EVENT_ICON.tech_interview },
  { id: 'call', look: NEUTRAL_LOOK, Icon: SCHEDULED_EVENT_ICON.screening_call },
  { id: 'followup', look: FOLLOWUP_LOOK, Icon: AlarmClock },
  { id: 'offer', look: EVENT_LOOK.offer },
  { id: 'archive', look: EVENT_LOOK.ghosted },
];

function Marker({ entry }: Readonly<{ entry: LegendEntry }>) {
  const { look, Icon } = entry;
  return (
    <span
      aria-hidden
      className="flex size-5 flex-none items-center justify-center rounded-xs"
      style={{ backgroundColor: look.color, color: look.contrastColor }}
    >
      {Icon && <Icon size={16} strokeWidth={1.9} />}
    </span>
  );
}

export function CalendarLegend() {
  return (
    <ul
      aria-label={COPY.legendLabel}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-soft pt-3"
    >
      {LEGEND.map((entry) => (
        <li key={entry.id} className="flex items-center gap-2 text-[12px] text-ink-2">
          <Marker entry={entry} />
          {COPY.legend[entry.id]}
        </li>
      ))}
    </ul>
  );
}
