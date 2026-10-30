import {
  type ApplicationCard as ApplicationCardData,
  isActiveStage,
  type ScheduledEventKind,
  SOURCE_LABELS,
} from '@jobflow/shared';
import { CalendarClock, type LucideIcon, PhoneCall } from 'lucide-react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { formatDaysInStage } from '../lib/days-in-stage';
import { formatNextEvent, type ScheduledEventSlot } from '../lib/next-event';
import { formatSalaryRange } from '../lib/salary';
import type { ApplicationCardContext } from '../model/card-context';
import { CARD_FRAME } from './card-frame';
import { CardHeading } from './card-heading';
import { OfferCard } from './offer-card';
import { ScoreBadge } from './score-badge';
import { SilenceIndicator } from './silence-indicator';
import { STAGE_COLOR_CLASS } from './stage-color';

const COPY = uk.application;

export type ApplicationCardProps = Readonly<{
  application: ApplicationCardData;
  view?: { density?: 'full' | 'compact' };
  context: ApplicationCardContext;
}>;

type CardPartProps = Readonly<{ application: ApplicationCardData; silent: boolean }>;

const EVENT_ICON: Record<ScheduledEventKind, LucideIcon> = {
  screening_call: PhoneCall,
  tech_interview: CalendarClock,
  final_interview: CalendarClock,
  offer_call: PhoneCall,
  other: CalendarClock,
};

const CARD_LOOK = {
  live: 'bg-surface text-ink shadow-e1 duration-(--duration-base) ease-standard hover:shadow-e2 active:shadow-e1 motion-safe:transition-[translate,box-shadow] motion-safe:hover:-translate-y-0.75 motion-safe:active:translate-y-0',
  silent: 'bg-surface-2 text-ink-2 inset-ring inset-ring-line-soft',
};

function StackTags({ application }: Readonly<{ application: ApplicationCardData }>) {
  const hidden = application.stackCount - application.stack.length;
  return (
    <div className="flex flex-wrap gap-1.25 text-[11.5px]">
      {application.stack.map((tag) => (
        <span
          key={tag}
          className="rounded-[7px] bg-surface-2 px-2 py-0.5 text-ink-2 inset-ring inset-ring-line-soft"
        >
          {tag}
        </span>
      ))}
      {hidden > 0 && (
        <span className="px-0.75 py-0.5 text-ink-3 tabular-nums">{COPY.stackMore(hidden)}</span>
      )}
    </div>
  );
}

function NextEventChip({
  event,
  context,
}: Readonly<{ event: ScheduledEventSlot; context: ApplicationCardContext }>) {
  const Icon = EVENT_ICON[event.kind];
  return (
    <span className="flex items-center gap-2 rounded-sm bg-accent-tint px-2.25 py-1.5 text-[12px] font-medium text-accent-ink tabular-nums">
      <Icon aria-hidden size={14} className="flex-none" />
      {formatNextEvent({ event, now: context.now, timeZone: context.timeZone })}
    </span>
  );
}

function DaysInStage({
  application,
  context,
}: Readonly<{ application: ApplicationCardData; context: ApplicationCardContext }>) {
  const stage = application.currentStage;
  const { stageNormDays } = context;
  if (!isActiveStage(stage) || stageNormDays === undefined) {
    return null;
  }
  return (
    <span className="flex items-center gap-2 text-[12px] text-ink-2 tabular-nums">
      <span
        aria-hidden
        className={cn('size-1.75 flex-none rounded-[2px]', STAGE_COLOR_CLASS[stage])}
      />
      {formatDaysInStage({ daysInStage: application.daysInStage, stageNormDays })}
    </span>
  );
}

function CardFooter({ application, silent }: CardPartProps) {
  const salary = formatSalaryRange(application);
  return (
    <div className={CARD_FRAME.footer}>
      <span
        className={cn(
          CARD_FRAME.salary,
          salary !== null && 'tabular-nums',
          salary !== null && !silent && 'font-medium',
        )}
      >
        {salary ?? COPY.salary.unknown}
      </span>
      {application.silenceLevel === 'none' ? (
        <span className="text-[10.5px] font-semibold tracking-[0.06em] uppercase">
          {SOURCE_LABELS[application.source].labelUk}
        </span>
      ) : (
        <SilenceIndicator application={application} />
      )}
    </div>
  );
}

export function ApplicationCard({ application, view, context }: ApplicationCardProps) {
  if (application.currentStage === 'offer') {
    return <OfferCard application={application} context={context} />;
  }
  const silent = application.silenceLevel === 'silent';
  const showStack = view?.density !== 'compact' && application.stack.length > 0;
  return (
    <article
      className={cn(
        CARD_FRAME.article,
        CARD_LOOK[silent ? 'silent' : 'live'],
        showStack ? 'gap-2.75' : 'gap-2.5',
      )}
    >
      <CardHeading
        application={application}
        badge={<ScoreBadge application={application} view={{ muted: silent }} />}
      />
      {showStack && <StackTags application={application} />}
      {application.nextScheduledEvent !== null && (
        <NextEventChip event={application.nextScheduledEvent} context={context} />
      )}
      <DaysInStage application={application} context={context} />
      <CardFooter application={application} silent={silent} />
    </article>
  );
}
