'use client';

import { motion } from 'motion/react';

import { AiSectionBody, applicationAiQueryOptions, useAiSection } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { WAITING_DOT } from '@/shared/ui/async-state';
import { Button } from '@/shared/ui/button';
import { ROW } from '@/shared/ui/list-stagger';
import { STATE_TEXT } from '@/shared/ui/state-text';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import type { BulkRow } from '../model/use-bulk-followups';
import { FollowupPanel } from './followup-panel';
import { QueueSweep } from './followup-queued';

export type BulkFollowupRowProps = Readonly<{
  row: BulkRow;
  queue: Readonly<{ ahead: number; onSkip: (applicationId: BulkRow['card']['id']) => void }>;
}>;

const COPY = uk.ghosted.sheet;

function QueuedLook({ ahead }: Readonly<{ ahead: number }>) {
  return (
    <div role="status" className="flex flex-col gap-2.5">
      <p className={cn('flex items-center gap-2.25 text-link tabular-nums', STATE_TEXT.eyebrow)}>
        {WAITING_DOT}
        {ahead === 0 ? COPY.next : COPY.ahead(ahead)}
      </p>
      <QueueSweep />
    </div>
  );
}

function RowBody({ row, ahead }: Readonly<{ row: BulkRow; ahead: number }>) {
  const section = useAiSection({
    query: applicationAiQueryOptions({ id: row.card.id, segment: 'followup' }),
    shown: true,
  });
  if (row.state === 'queued') return <QueuedLook ahead={ahead} />;
  return (
    <AiSectionBody section={section}>
      {(ready) => (
        <FollowupPanel
          application={row.card}
          followup={{ ...ready, queueRefused: row.state === 'manual' }}
        />
      )}
    </AiSectionBody>
  );
}

export function BulkFollowupRow({ row, queue }: BulkFollowupRowProps) {
  const { card } = row;
  return (
    <motion.li
      layout
      variants={ROW}
      exit="hidden"
      aria-label={`${card.company} · ${card.position}`}
      className="flex flex-col gap-3.5 rounded-lg bg-surface p-4.5 shadow-e1"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-[15px] font-semibold text-ink">{card.company}</p>
          <p className="truncate text-[13px] text-ink-3">{card.position}</p>
        </div>
        <Button
          variant="ghost"
          className={cn('h-9 flex-none', TOUCH_HEIGHT)}
          onClick={() => {
            queue.onSkip(card.id);
          }}
        >
          {COPY.skip}
        </Button>
      </div>
      <RowBody row={row} ahead={queue.ahead} />
    </motion.li>
  );
}
