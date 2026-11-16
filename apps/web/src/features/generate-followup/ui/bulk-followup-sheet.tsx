'use client';

import { X } from 'lucide-react';
import { AnimatePresence } from 'motion/react';

import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Sheet, SheetClose } from '@/shared/ui/sheet';
import { StaggeredList } from '@/shared/ui/staggered-list';
import { STATE_TEXT } from '@/shared/ui/state-text';

import type { BulkFollowups, BulkRow } from '../model/use-bulk-followups';
import { BulkFollowupRow } from './bulk-followup-row';

export type BulkFollowupSheetProps = Readonly<{ queue: BulkFollowups; onClose: () => void }>;

const COPY = uk.ghosted.sheet;

function aheadOf(rows: readonly BulkRow[], index: number): number {
  return rows.slice(0, index).filter((row) => row.state === 'queued').length;
}

function SheetHead({ rows }: Readonly<{ rows: readonly BulkRow[] }>) {
  const sent = rows.filter((row) => row.state === 'sent').length;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-[22px] leading-[1.2] text-ink">{COPY.title}</h2>
        <SheetClose asChild>
          <Button
            variant="ghost"
            aria-label={COPY.close}
            icon={<X aria-hidden size={20} strokeWidth={1.9} />}
          />
        </SheetClose>
      </div>
      <p aria-live="polite" className={STATE_TEXT.meta}>
        {COPY.progress(sent, rows.length)}
      </p>
      <p className="text-[14px] leading-[1.55] text-ink-2">{COPY.note}</p>
    </div>
  );
}

export function BulkFollowupSheet({ queue, onClose }: BulkFollowupSheetProps) {
  const { rows } = queue;
  return (
    <Sheet title={COPY.title} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <SheetHead rows={rows} />
        <StaggeredList label={COPY.title} className="flex flex-col gap-3">
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((row, index) => (
              <BulkFollowupRow
                key={row.card.id}
                row={row}
                queue={{ ahead: aheadOf(rows, index), onSkip: queue.skip }}
              />
            ))}
          </AnimatePresence>
        </StaggeredList>
      </div>
    </Sheet>
  );
}
