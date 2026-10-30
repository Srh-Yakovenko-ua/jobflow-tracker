'use client';

import { REJECTION_REASONS, STAGE_LABELS } from '@jobflow/shared';

import type { MovingApplication } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { useCountdown } from '@/shared/lib/use-countdown';
import { Button } from '@/shared/ui/button';
import { DialogFooter } from '@/shared/ui/dialog';
import { TextSkeleton } from '@/shared/ui/skeleton';

import { type ReasonInsight, reasonInsightOf } from '../lib/reason-insight';
import type { RejectionActions, SavedStep } from '../model/rejection-step';
import { useReasonsSummaryQuery } from '../model/use-reasons-summary-query';
import { ReasonsBar } from './reasons-bar';

const COPY = uk.board.reject;

const FOOTER_BUTTON = 'h-9.5 rounded-[10px] px-3.75 text-[13px]';

export type RejectionSavedProps = Readonly<{
  application: MovingApplication;
  step: SavedStep;
  actions: Pick<RejectionActions, 'onUndo' | 'onNote' | 'onDone'>;
}>;

type InsightProps = Readonly<{ insight: ReasonInsight; stage: string }>;

function insightLineOf({ insight, stage }: InsightProps): string {
  const total = COPY.insight.total({ stage, total: insight.total });
  if (insight.claim === null) return total;
  const claim = COPY.insight[insight.claim.kind](REJECTION_REASONS[insight.claim.code].labelUk);
  return `${total} ${claim}`;
}

function SavedInsight({ application, step }: Omit<RejectionSavedProps, 'actions'>) {
  const summary = useReasonsSummaryQuery(application.currentStage);
  if (summary.isError) return null;
  if (!summary.isSuccess || summary.isFetching) return <TextSkeleton />;
  const insight = reasonInsightOf({ summary: summary.data, picked: step.reasonCode });
  if (!insight) return null;
  const stage = STAGE_LABELS[application.currentStage].labelUk;
  return (
    <>
      <p className="text-[13.5px] leading-[1.6] text-ink-2">{insightLineOf({ insight, stage })}</p>
      <div className="flex flex-col gap-2.75">
        <p className="eyebrow tracking-[0.12em] text-ink-3">{COPY.saved.reasonsAt(stage)}</p>
        <ReasonsBar reasons={insight.reasons} />
      </div>
    </>
  );
}

function SavedFooter({ step, actions }: Omit<RejectionSavedProps, 'application'>) {
  const secondsLeft = useCountdown(step.undoUntil);
  return (
    <DialogFooter className="gap-3">
      {secondsLeft > 0 && (
        <Button variant="ghost" className="-mx-2 px-2 text-[13px]" onClick={actions.onUndo}>
          {COPY.saved.undo}
        </Button>
      )}
      <div className="ml-auto flex flex-wrap gap-2.25">
        <Button
          variant="secondary"
          className={`${FOOTER_BUTTON} bg-surface`}
          onClick={actions.onNote}
        >
          {COPY.saved.addNote}
        </Button>
        <Button className={FOOTER_BUTTON} onClick={actions.onDone}>
          {COPY.saved.done}
        </Button>
      </div>
    </DialogFooter>
  );
}

export function RejectionSaved({ application, step, actions }: RejectionSavedProps) {
  return (
    <>
      <SavedInsight application={application} step={step} />
      <SavedFooter step={step} actions={actions} />
    </>
  );
}
