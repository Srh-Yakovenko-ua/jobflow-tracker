'use client';

import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/chip';
import { EmptyState } from '@/shared/ui/empty-state';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';
import { FirstRunState } from '@/widgets/kanban-board';

import { GallerySection, STATE_GRID, StateRule } from './gallery';
import { ANALYTICS_PROGRESS } from './state-specimens';

const FIRST_RUN = uk.devUi.firstRun;

const SCREENS = uk.devUi.emptyScreens;

const SCREEN_ACTION = cn(
  'h-auto max-w-full min-h-control-md py-1.5 whitespace-normal',
  TOUCH_HEIGHT,
);

function FirstRunBoard() {
  return (
    <FirstRunState
      action={
        <>
          <Button size="lg" className={TOUCH_HEIGHT}>
            {FIRST_RUN.addFirst}
          </Button>
          <Button size="lg" variant="secondary" className={TOUCH_HEIGHT}>
            {FIRST_RUN.bookmarklet}
          </Button>
        </>
      }
    />
  );
}

function SearchFilters() {
  const [filters, setFilters] = useState<readonly string[]>(SCREENS.search.filters);
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <Chip
          key={filter}
          label={filter}
          tone="neutral"
          onRemove={() => {
            setFilters((current) => current.filter((kept) => kept !== filter));
          }}
        />
      ))}
    </div>
  );
}

function ResumeDropZone() {
  return (
    <p className="rounded-[9px] border-[1.5px] border-dashed border-line bg-surface-2 p-4 text-center text-[13px] text-ink-3">
      {SCREENS.resumes.drop}
    </p>
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
        <FirstRunBoard />
      </GallerySection>
      <GallerySection header={SCREENS}>
        <ScreenEmptyStates />
        <StateRule rule={uk.devUi.stateRules.empty} />
      </GallerySection>
    </>
  );
}
