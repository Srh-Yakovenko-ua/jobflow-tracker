'use client';

import {
  type ApplicationCard,
  REJECTION_REASON_CODES,
  REJECTION_REASONS,
  REJECTION_SIDES,
  type RejectionReasonCode,
  type RejectionSide,
  STAGE_LABELS,
} from '@jobflow/shared';
import { CircleMinus, CircleSlash2, type LucideIcon } from 'lucide-react';
import { useId } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent } from '@/shared/ui/dialog';

const COPY = uk.board.reject;

type PickedSide = Exclude<RejectionSide, 'system'>;

const PICKED_SIDES = REJECTION_SIDES.filter((side): side is PickedSide => side !== 'system');

const SIDE_MARK: Record<PickedSide, { Icon: LucideIcon; className: string }> = {
  company: { Icon: CircleMinus, className: 'text-rejected' },
  candidate: { Icon: CircleSlash2, className: 'text-withdrawn' },
};

export type RejectionReasonDialogProps = Readonly<{
  move: Readonly<{ application: ApplicationCard }> | null;
  onPick: (reasonCode: RejectionReasonCode) => void;
  onCancel: () => void;
  onCloseAutoFocus?: ((event: Event) => void) | undefined;
}>;

type ReasonGroupProps = Readonly<{ side: PickedSide; onPick: (code: RejectionReasonCode) => void }>;

function reasonsOf(side: PickedSide): RejectionReasonCode[] {
  return REJECTION_REASON_CODES.filter((code) => REJECTION_REASONS[code].side === side).sort(
    (left, right) => REJECTION_REASONS[left].sortOrder - REJECTION_REASONS[right].sortOrder,
  );
}

function ReasonGroup({ side, onPick }: ReasonGroupProps) {
  const headingId = useId();
  const { Icon, className } = SIDE_MARK[side];
  return (
    <div role="group" aria-labelledby={headingId} className="flex flex-col gap-2.5">
      <span id={headingId} className="flex items-center gap-2.25 text-[12.5px] font-semibold">
        <Icon aria-hidden size={16} className={cn('flex-none', className)} />
        {COPY.sides[side]}
      </span>
      <div className="flex flex-wrap gap-2">
        {reasonsOf(side).map((code) => (
          <Button
            key={code}
            variant="secondary"
            size="lg"
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

function eyebrowOf(application: ApplicationCard): string {
  const from = STAGE_LABELS[application.currentStage].labelUk;
  return COPY.eyebrow({ company: application.company, from });
}

export function RejectionReasonDialog({
  move,
  onPick,
  onCancel,
  onCloseAutoFocus,
}: RejectionReasonDialogProps) {
  return (
    <Dialog
      open={move !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      {move && (
        <DialogContent
          onCloseAutoFocus={onCloseAutoFocus}
          header={{
            eyebrow: eyebrowOf(move.application),
            title: COPY.title,
            description: COPY.description,
          }}
        >
          {PICKED_SIDES.map((side) => (
            <ReasonGroup key={side} side={side} onPick={onPick} />
          ))}
          <Button
            variant="ghost"
            size="lg"
            className="self-start"
            onClick={() => {
              onPick('unspecified');
            }}
          >
            {COPY.skip}
          </Button>
        </DialogContent>
      )}
    </Dialog>
  );
}
