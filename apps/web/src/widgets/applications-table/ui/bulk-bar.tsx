import type { ApplicationListItem } from '@jobflow/shared';
import { ArrowRight, CircleSlash2 } from 'lucide-react';
import { useState } from 'react';

import { type BulkMoveTarget, useBulkMoveMutation } from '@/features/move-application';
import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from '@/shared/ui/dialog';

import { SELECT_ALL_ID } from './table-head';

const COPY = uk.applicationsTable.bulk;

export type BulkBarProps = Readonly<{
  picked: readonly ApplicationListItem[];
  actions: { onDone: () => void };
}>;

function focusSelectAll() {
  document.getElementById(SELECT_ALL_ID)?.focus();
}

export function BulkBar({ picked, actions }: BulkBarProps) {
  const bulk = useBulkMoveMutation();
  const [confirming, setConfirming] = useState(false);
  const done = () => {
    actions.onDone();
    focusSelectAll();
  };
  const move = (target: BulkMoveTarget) => {
    bulk.move(
      { applications: picked, target },
      {
        onSuccess: () => {
          setConfirming(false);
          done();
        },
      },
    );
  };
  return (
    <div
      role="group"
      aria-label={COPY.label}
      className="flex animate-fade-in flex-wrap items-center gap-2.5 bg-accent-tint px-4 py-2.5 shadow-[inset_0_-1px_0_var(--line-soft)]"
    >
      <p className="text-[12.5px] font-semibold text-accent-ink tabular-nums">
        {COPY.picked(picked.length)}
      </p>
      <span className="flex-1" />
      <Button
        variant="secondary"
        size="xs"
        icon={<ArrowRight aria-hidden size={13} />}
        disabled={bulk.isPending}
        onClick={() => {
          move('next');
        }}
      >
        {COPY.next}
      </Button>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogTrigger asChild>
          <Button
            variant="secondary"
            size="xs"
            icon={<CircleSlash2 aria-hidden size={13} />}
            disabled={bulk.isPending}
          >
            {COPY.withdraw}
          </Button>
        </DialogTrigger>
        <DialogContent
          header={{
            title: COPY.confirm.title(picked.length),
            description: COPY.confirm.description,
          }}
        >
          <DialogFooter className="justify-end">
            <DialogClose asChild>
              <Button variant="outline">{COPY.confirm.cancel}</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={bulk.isPending}
              onClick={() => {
                move('withdrawn');
              }}
            >
              {COPY.confirm.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button variant="ghost" size="xs" disabled={bulk.isPending} onClick={done}>
        {COPY.clear}
      </Button>
    </div>
  );
}
