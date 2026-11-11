'use client';

import { RESUME_MIMES } from '@jobflow/shared';
import { useState } from 'react';

import { FirstRunState } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { ChipList } from '@/shared/ui/chip-list';
import { DropZone } from '@/shared/ui/drop-zone';
import { EmptyState } from '@/shared/ui/empty-state';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { GallerySection, STATE_GRID, StateRule } from './gallery';
import { ANALYTICS_PROGRESS, specimenNoop } from './state-specimens';

const FIRST_RUN = uk.devUi.firstRun;

const SCREENS = uk.devUi.emptyScreens;

const RESUME_PICKER = { label: uk.resumes.upload.pick, accept: RESUME_MIMES.join(',') };

const SCREEN_ACTION = cn(
  'h-auto max-w-full min-h-control-md py-1.5 whitespace-normal',
  TOUCH_HEIGHT,
);

function SearchFilters() {
  const [filters, setFilters] = useState<readonly string[]>(SCREENS.search.filters);
  return (
    <ChipList
      label={uk.board.filters.chips.label}
      items={filters.map((filter) => ({
        id: filter,
        label: filter,
        onRemove: () => {
          setFilters((current) => current.filter((kept) => kept !== filter));
        },
      }))}
    />
  );
}

function ResumeDropZone() {
  return (
    <DropZone
      picker={RESUME_PICKER}
      onFile={specimenNoop}
      className="flex flex-col items-center gap-3 rounded-[9px] p-4 text-center text-[13px] text-ink-3"
    >
      <p>{SCREENS.resumes.drop}</p>
    </DropZone>
  );
}

function QuietReminders() {
  return (
    <p className="flex items-center gap-2.25 text-[13px] text-offer tabular-nums">
      <span aria-hidden className="size-2.25 flex-none rounded-pill bg-offer" />
      {SCREENS.reminders.silent}
    </p>
  );
}

function ScreenEmptyStates() {
  return (
    <div className={STATE_GRID}>
      <EmptyState content={SCREENS.analytics.content} progress={ANALYTICS_PROGRESS} />
      <EmptyState content={SCREENS.resumes.content} slots={{ figure: <ResumeDropZone /> }} />
      <EmptyState content={SCREENS.reminders.content} slots={{ figure: <QuietReminders /> }} />
      <EmptyState content={SCREENS.search.content} slots={{ figure: <SearchFilters /> }} />
      <EmptyState
        content={SCREENS.ghosted.content}
        view={{ tone: 'ghosted' }}
        slots={{
          action: (
            <Button variant="secondary" className={SCREEN_ACTION}>
              {SCREENS.ghosted.action}
            </Button>
          ),
        }}
      />
      <EmptyState
        content={SCREENS.finished.content}
        view={{ tone: 'offer' }}
        slots={{ action: <Button className={SCREEN_ACTION}>{SCREENS.finished.action}</Button> }}
      />
    </div>
  );
}

export function EmptyStatesSection() {
  return (
    <>
      <GallerySection header={FIRST_RUN}>
        <FirstRunState />
      </GallerySection>
      <GallerySection header={SCREENS}>
        <ScreenEmptyStates />
        <StateRule rule={uk.devUi.stateRules.empty} />
      </GallerySection>
    </>
  );
}
