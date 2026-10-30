import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import type { Incident } from '@/shared/lib/incident';
import { formatIncidentTime } from '@/shared/lib/state-format';

import { Button } from './button';
import { STATE_TEXT } from './state-text';
import { TOUCH_HEIGHT } from './touch-height';

const COPY = uk.states.crash;

export type CrashScope = 'page' | 'widget';

export type CrashPanelView = { scope: CrashScope; timeZone?: string | undefined };

export type CrashPanelProps = Readonly<{
  incident: Incident;
  view: CrashPanelView;
  onRetry: () => void;
}>;

export function CrashPanel({ incident, view, onRetry }: CrashPanelProps) {
  const scope = COPY[view.scope];
  const time = formatIncidentTime({ at: incident.occurredAt, timeZone: view.timeZone });
  return (
    <div role="alert" className="flex min-w-0 flex-col gap-3 bg-surface p-5.5 shadow-e1">
      <span className={cn(STATE_TEXT.eyebrow, 'text-ink-3')}>{scope.eyebrow}</span>
      <h2 className="font-display text-[26px] leading-[1.2] text-ink">{COPY.title}</h2>
      <p className="max-w-[56ch] text-[14.5px] leading-[1.6] text-ink-2">{scope.body}</p>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button size="lg" className={TOUCH_HEIGHT} onClick={onRetry}>
          {COPY.action}
        </Button>
        <span className={STATE_TEXT.meta}>{COPY.meta(incident.code, time)}</span>
      </div>
    </div>
  );
}
