'use client';

import { STAGE_LABELS } from '@jobflow/shared';
import Link from 'next/link';
import { useId } from 'react';

import { SilenceIndicator } from '@/entities/application';
import { type SilentRow, SnoozeMenu } from '@/features/snooze-reminder';
import { uk } from '@/shared/i18n';
import { buttonLinkClasses } from '@/shared/ui/button';

import { ReplyMenu, type ReplyMenuActions } from './reply-menu';

const COPY = uk.reminders;

export type SilentRowActions = Readonly<{
  moveTo: ReplyMenuActions['moveTo'];
  onLeave: () => void;
}>;

export type SilentCardRowProps = Readonly<{ row: SilentRow; actions: SilentRowActions }>;

export function SilentCardRow({ row, actions }: SilentCardRowProps) {
  const { card, reminder } = row;
  const headingId = useId();
  return (
    <article
      aria-labelledby={headingId}
      className="flex flex-col gap-3.5 rounded-lg bg-surface p-4 shadow-e1 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h3 id={headingId} className="text-[15px] font-semibold wrap-break-word text-ink">
          {card.company}
        </h3>
        <p className="text-[13px] wrap-break-word text-ink-2">
          {COPY.row.position(card.position, STAGE_LABELS[card.currentStage].labelUk)}
        </p>
        <span className="text-[12.5px] text-ink-2">
          <SilenceIndicator application={card} />
        </span>
      </div>
      <div className="flex flex-none flex-wrap gap-2">
        <Link
          href={`/applications/${card.id}#follow-up`}
          className={buttonLinkClasses({ variant: 'primary', size: 'sm' })}
        >
          {COPY.actions.followUp}
        </Link>
        <ReplyMenu
          application={card}
          actions={{ moveTo: actions.moveTo, onMoved: actions.onLeave }}
        />
        {reminder !== null && (
          <SnoozeMenu reminder={reminder} actions={{ onSnoozed: actions.onLeave }} />
        )}
      </div>
    </article>
  );
}
