'use client';

import { AnimatePresence } from 'motion/react';
import { useRef } from 'react';

import { RejectionReasonDialog } from '@/features/reject-with-reason';
import { uk } from '@/shared/i18n';
import { Fade } from '@/shared/ui/fade';
import { PAGE_TITLE } from '@/shared/ui/page-title';

import {
  type InterviewsSection,
  type SilenceSection,
  useRemindersPage,
} from '../model/use-reminders-page';
import { InterviewRow } from './interview-row';
import { PlanSection } from './plan-section';
import { RemindersEmpty } from './reminders-empty';
import { SectionBody, SectionFrame } from './section-frame';
import { SilentCardRow, type SilentRowActions } from './silent-row';

const COPY = uk.reminders;

const ROW = { motion: { layout: 'position' } } as const;

type SilenceListProps = Readonly<{ silence: SilenceSection; actions: SilentRowActions }>;

function SilenceList({ silence, actions }: SilenceListProps) {
  const rows = silence.rows ?? [];
  return (
    <div className="flex animate-fade-in flex-col gap-2.5">
      <AnimatePresence mode="popLayout" initial={false}>
        {rows.map((row) => (
          <Fade key={row.card.id} motion={ROW.motion}>
            <SilentCardRow row={row} actions={actions} />
          </Fade>
        ))}
        {rows.length === 0 && (
          <Fade key="empty">
            <RemindersEmpty silenceDays={silence.silenceDays} />
          </Fade>
        )}
      </AnimatePresence>
    </div>
  );
}

function InterviewList({ interviews }: Readonly<{ interviews: InterviewsSection }>) {
  const { view } = interviews;
  if (view === undefined) return null;
  if (view.rows.length === 0) {
    return <p className="animate-fade-in text-[14px] text-ink-2">{COPY.interviews.empty}</p>;
  }
  return (
    <div className="flex animate-fade-in flex-col gap-2.5">
      {view.rows.map((interview) => (
        <InterviewRow key={interview.id} interview={interview} context={view.context} />
      ))}
    </div>
  );
}

export function RemindersPage() {
  const page = useRemindersPage();
  const silenceTitleRef = useRef<HTMLHeadingElement>(null);
  const focusSilence = () => {
    silenceTitleRef.current?.focus();
  };
  const { silence, interviews, plan, reply } = page;
  return (
    <div className="flex max-w-180 min-w-0 flex-col gap-8">
      <h2 className={PAGE_TITLE}>{COPY.title}</h2>
      <SectionFrame title={COPY.silence.title} titleRef={silenceTitleRef}>
        <SectionBody load={silence.load} ready={silence.rows !== undefined}>
          <SilenceList
            silence={silence}
            actions={{ moveTo: reply.moveTo, onLeave: focusSilence }}
          />
        </SectionBody>
      </SectionFrame>
      <SectionFrame title={COPY.interviews.title}>
        <SectionBody load={interviews.load} ready={interviews.view !== undefined}>
          <InterviewList interviews={interviews} />
        </SectionBody>
      </SectionFrame>
      <PlanSection plan={plan} />
      <RejectionReasonDialog
        prompt={reply.rejection.prompt}
        actions={reply.rejection.actions}
        handlers={{
          onCloseAutoFocus: (event) => {
            event.preventDefault();
            focusSilence();
          },
        }}
      />
    </div>
  );
}
