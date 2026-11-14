'use client';

import type { Summary } from '@jobflow/shared';
import { Check } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import Link from 'next/link';

import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Fade } from '@/shared/ui/fade';
import { InlineAlert } from '@/shared/ui/inline-alert';

import { useSaveSummaryPlan } from '../model/use-save-summary-plan';

const COPY = uk.summary.plan;

export type SaveSummaryPlanButtonProps = Readonly<{ summary: Summary }>;

function SavedLine() {
  return (
    <p role="status" className="flex min-h-9 flex-wrap items-center gap-x-2.25 gap-y-1 text-ink-2">
      <Check aria-hidden size={16} strokeWidth={1.9} className="flex-none text-offer" />
      <span className="text-[13.5px] font-semibold text-ink">{COPY.saved}</span>
      <Link
        href="/reminders"
        className="inline-flex min-h-11 items-center text-[13.5px] text-link underline underline-offset-4 transition-colors duration-(--duration-instant) ease-standard hover:text-ink active:text-ink"
      >
        {COPY.open}
      </Link>
    </p>
  );
}

export function SaveSummaryPlanButton({ summary }: SaveSummaryPlanButtonProps) {
  const plan = useSaveSummaryPlan(summary);
  return (
    <>
      <AnimatePresence mode="popLayout" initial={false}>
        {plan.saved ? (
          <Fade key="saved">
            <SavedLine />
          </Fade>
        ) : (
          <Fade key="save">
            <Button loading={plan.isPending} onClick={plan.save}>
              {COPY.save}
            </Button>
          </Fade>
        )}
      </AnimatePresence>
      <InlineAlert
        message={plan.failed && !plan.saved ? COPY.failed : null}
        className="basis-full"
      />
    </>
  );
}
