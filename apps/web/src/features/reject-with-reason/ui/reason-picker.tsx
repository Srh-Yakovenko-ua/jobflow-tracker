'use client';

import { REJECTION_REASONS, type RejectionReasonCode } from '@jobflow/shared';
import { CircleMinus, CircleSlash2, type LucideIcon } from 'lucide-react';
import { useId } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { DialogFooter } from '@/shared/ui/dialog';

import { keyForReason, PICKED_SIDES, type PickedSide, reasonsOf } from '../lib/reason-order';

const COPY = uk.board.reject;

type SideLook = { Icon: LucideIcon; mark: string; chip: string };

const SIDE_LOOK: Record<PickedSide, SideLook> = {
  company: {
    Icon: CircleMinus,
    mark: 'text-rejected',
    chip: 'bg-rejected/6 text-[color:color-mix(in_oklab,var(--color-rejected)_55%,var(--color-ink))] inset-ring-rejected/20 not-disabled:hover:bg-rejected/10',
  },
  candidate: {
    Icon: CircleSlash2,
    mark: 'text-withdrawn',
    chip: 'bg-withdrawn/6 text-[color:color-mix(in_oklab,var(--color-withdrawn)_55%,var(--color-ink))] inset-ring-withdrawn/20 not-disabled:hover:bg-withdrawn/10',
  },
};

const CHIP = 'px-3.5 text-[13.5px] font-normal not-disabled:hover:-translate-y-px';

const SKIP = '-mx-2 px-2 text-[13px] font-normal text-ink-2 underline underline-offset-3';

export type ReasonPickerProps = Readonly<{ onPick: (reasonCode: RejectionReasonCode) => void }>;

type ReasonGroupProps = ReasonPickerProps & Readonly<{ side: PickedSide }>;

function ReasonGroup({ side, onPick }: ReasonGroupProps) {
  const headingId = useId();
  const { Icon, mark, chip } = SIDE_LOOK[side];
  return (
    <div role="group" aria-labelledby={headingId} className="flex flex-col gap-2.5">
      <span id={headingId} className="flex items-center gap-2.25 text-[12.5px] font-semibold">
        <Icon aria-hidden size={16} className={cn('flex-none', mark)} />
        {COPY.sides[side]}
      </span>
      <div className="flex flex-wrap gap-1.75">
        {reasonsOf(side).map((code) => (
          <Button
            key={code}
            variant="secondary"
            size="lg"
            aria-keyshortcuts={keyForReason(code)}
            className={cn(CHIP, chip)}
            onClick={() => {
              onPick(code);
            }}
          >
            {REJECTION_REASONS[code].labelUk}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function ReasonPicker({ onPick }: ReasonPickerProps) {
  return (
    <>
      <div className="flex flex-col gap-4.5">
        {PICKED_SIDES.map((side) => (
          <ReasonGroup key={side} side={side} onPick={onPick} />
        ))}
      </div>
      <DialogFooter>
        <Button
          variant="ghost"
          className={SKIP}
          onClick={() => {
            onPick('unspecified');
          }}
        >
          {COPY.skip}
        </Button>
        <span className="text-[11px] text-ink-3">{COPY.keysHint}</span>
      </DialogFooter>
    </>
  );
}
