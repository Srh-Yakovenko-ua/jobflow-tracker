import {
  type ApplicationCard as ApplicationCardData,
  type BoardCard,
  isActiveStage,
} from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { formatDaysInStage } from '../lib/days-in-stage';
import { draftStateOf } from '../lib/draft-state';
import type { ApplicationCardContext } from '../model/card-context';
import type { CardDensity } from '../model/card-density';
import { CardFooter } from './card-footer';
import { CARD_FRAME } from './card-frame';
import { CardHeading } from './card-heading';
import { NextEventChip } from './next-event-chip';
import { OfferCard } from './offer-card';
import { ParsingCard } from './parsing-card';
import { ReviewMark } from './review-mark';
import { ScoreBadge } from './score-badge';
import { SilenceIndicator } from './silence-indicator';
import { STAGE_COLOR_CLASS } from './stage-color';

const COPY = uk.application;

export type ApplicationCardProps = Readonly<{
  application: BoardCard;
  view?: { density?: CardDensity };
  context: ApplicationCardContext;
}>;

const CARD_LOOK = {
  live: 'bg-surface text-ink shadow-e1 duration-(--duration-base) ease-standard hover:shadow-e2 active:shadow-e1 motion-safe:transition-[translate,box-shadow] motion-safe:hover:-translate-y-0.75 motion-safe:active:translate-y-0',
  silent: 'bg-surface-2 text-ink-2 inset-ring inset-ring-line-soft',
};

const REVIEW_LOOK = 'animate-fade-in inset-ring inset-ring-accent/25';

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

type FieldsCardProps = ApplicationCardProps & Readonly<{ review: boolean }>;

function FieldsCard({ application, view, context, review }: FieldsCardProps) {
  const silent = application.silenceLevel === 'silent';
  const showStack = view?.density !== 'compact' && application.stack.length > 0;
  return (
    <article
      className={cn(
        CARD_FRAME.article,
        CARD_LOOK[silent ? 'silent' : 'live'],
        showStack ? 'gap-2.75' : 'gap-2.5',
        review && REVIEW_LOOK,
      )}
    >
      {review && <ReviewMark />}
      <CardHeading
        application={application}
        badge={<ScoreBadge application={application} view={{ muted: silent }} />}
      />
      {showStack && <StackTags application={application} />}
      {application.nextScheduledEvent !== null && (
        <NextEventChip event={application.nextScheduledEvent} context={context} />
      )}
      <DaysInStage application={application} context={context} />
      <CardFooter
        application={application}
        view={{ muted: silent }}
        aside={
          application.silenceLevel === 'none' ? undefined : (
            <SilenceIndicator application={application} />
          )
        }
      />
    </article>
  );
}

export function ApplicationCard(card: ApplicationCardProps) {
  const { application, context } = card;
  const draft = draftStateOf(application);
  if (draft === 'parsing') {
    return <ParsingCard parse={application} />;
  }
  if (application.currentStage === 'offer') {
    return <OfferCard application={application} context={context} />;
  }
  return <FieldsCard {...card} review={draft === 'review'} />;
}
