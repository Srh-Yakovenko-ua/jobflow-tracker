'use client';

import { AnimatePresence } from 'motion/react';
import { type ReactNode, type RefObject, useRef } from 'react';

import { RejectionReasonDialog } from '@/features/reject-with-reason';
import { uk } from '@/shared/i18n';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { Fade } from '@/shared/ui/fade';
import { PAGE_TITLE } from '@/shared/ui/page-title';
import { PageSkeleton } from '@/shared/ui/skeleton';

import {
  type InterviewsSection,
  type SectionLoad,
  type SilenceSection,
  useRemindersPage,
} from '../model/use-reminders-page';
import { InterviewRow } from './interview-row';
import { RemindersEmpty } from './reminders-empty';
import { SilentCardRow, type SilentRowActions } from './silent-row';

const COPY = uk.reminders;

const SECTION_TITLE = 'font-display text-[20px] leading-[1.2] text-ink';

const ROW = { motion: { layout: 'position' } } as const;

type SectionFrameProps = Readonly<{
  title: string;
  titleRef?: RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}>;

type SectionBodyProps = Readonly<{ load: SectionLoad; ready: boolean; children: ReactNode }>;

function SectionFrame({ title, titleRef, children }: SectionFrameProps) {
  return (
    <section className="flex min-w-0 flex-col gap-3.5">
      <h2 ref={titleRef} tabIndex={-1} className={SECTION_TITLE}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SectionBody({ load, ready, children }: SectionBodyProps) {
  if (ready) return children;
  if (!load.failed) return <PageSkeleton />;
  return <LoadFailedPanel onRetry={load.onRetry} retrying={load.retrying} />;
}

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
  const { silence, interviews, reply } = page;
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
