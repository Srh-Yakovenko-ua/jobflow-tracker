import {
  type ApplicationCard,
  REJECTION_REASONS,
  type RejectionReasonCode,
  STAGE_LABELS,
} from '@jobflow/shared';
import { Check } from 'lucide-react';

import { uk } from '@/shared/i18n';
import type { DialogHeader } from '@/shared/ui/dialog';

import type { RejectionPrompt } from '../model/rejection-step';

const COPY = uk.board.reject;

type SavedTitleOf = Readonly<{ application: ApplicationCard; reasonCode?: RejectionReasonCode }>;

function chooseHeader(application: ApplicationCard): DialogHeader {
  const from = STAGE_LABELS[application.currentStage].labelUk;
  return {
    eyebrow: COPY.eyebrow({ company: application.company, from }),
    title: COPY.title,
    description: COPY.description,
  };
}

function savedTitleOf({ application, reasonCode }: SavedTitleOf): string {
  const reason =
    reasonCode === undefined || reasonCode === 'unspecified'
      ? undefined
      : REJECTION_REASONS[reasonCode].labelUk;
  return COPY.saved.title({ company: application.company, reason });
}

function SavedEyebrow() {
  return (
    <span className="flex items-center gap-2 text-offer">
      <span className="grid size-5.5 flex-none place-items-center rounded-sm bg-offer/12">
        <Check aria-hidden size={14} />
      </span>
      {COPY.saved.eyebrow}
    </span>
  );
}

export function stepHeader({ application, step }: RejectionPrompt): DialogHeader {
  switch (step.kind) {
    case 'choose':
    case 'saving':
      return chooseHeader(application);
    case 'saved':
      return {
        eyebrow: <SavedEyebrow />,
        title: (
          <span className="block text-[22px] leading-[1.24]">
            {savedTitleOf({ application, reasonCode: step.reasonCode })}
          </span>
        ),
      };
    case 'note':
      return { eyebrow: savedTitleOf({ application }), title: COPY.note.title };
    default: {
      const unhandled: never = step;
      throw new Error(`Unknown rejection step ${JSON.stringify(unhandled)}`);
    }
  }
}
