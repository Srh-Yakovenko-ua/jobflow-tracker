'use client';

import { AI_JOB_STATUSES } from '@jobflow/shared';
import { type ReactNode, useState } from 'react';

import { uk } from '@/shared/i18n';
import { AsyncState } from '@/shared/ui/async-state';
import { CardSkeleton, ChartSkeleton, ColumnSkeleton, TextSkeleton } from '@/shared/ui/skeleton';
import { SKELETON_LIMITS } from '@/shared/ui/skeleton-motion';
import { STATE_TEXT } from '@/shared/ui/state-text';
import { Switch } from '@/shared/ui/switch';

import { GallerySection, Note, Specimen, STATE_GRID, StateRule, TILE_GRID } from './gallery';
import { AI_JOBS, SPECIMEN_ACTIONS } from './state-specimens';

const COPY = uk.devUi.skeletons;

const ASYNC = uk.devUi.asyncStates;

const MANY_IDS = Array.from(
  { length: SKELETON_LIMITS.staticFrom },
  (_, slot) => `card-skeleton-${String(slot)}`,
);

type CaptionedProps = Readonly<{ caption: string; children: ReactNode }>;

function Captioned({ caption, children }: CaptionedProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      {children}
      <span className={STATE_TEXT.meta}>{caption}</span>
    </div>
  );
}

function SkeletonSpecimens() {
  return (
    <div className={STATE_GRID}>
      <Captioned caption={COPY.column}>
        <ColumnSkeleton />
      </Captioned>
      <Captioned caption={COPY.chart}>
        <ChartSkeleton />
      </Captioned>
      <Captioned caption={COPY.ai}>
        <AsyncState job={AI_JOBS.processing}>
          <p className="text-[14px] leading-[1.35] font-semibold text-ink">{COPY.aiTitle}</p>
          <TextSkeleton />
        </AsyncState>
      </Captioned>
    </div>
  );
}

function AsyncStateSpecimens() {
  return (
    <Specimen eyebrow={ASYNC.eyebrow}>
      <div className={STATE_GRID}>
        {AI_JOB_STATUSES.map((status) => (
          <AsyncState key={status} job={AI_JOBS[status]} actions={SPECIMEN_ACTIONS}>
            <p className="body text-ink-2">{ASYNC[status]}</p>
          </AsyncState>
        ))}
      </div>
    </Specimen>
  );
}

function ManySkeletons() {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-2.5">
      <Switch label={COPY.many.label} checked={shown} onCheckedChange={setShown} />
      <Note>{COPY.many.note}</Note>
      {shown && (
        <div className={TILE_GRID}>
          {MANY_IDS.map((id) => (
            <CardSkeleton key={id} />
          ))}
        </div>
      )}
    </div>
  );
}

export function LoadingStatesSection() {
  return (
    <GallerySection header={COPY}>
      <SkeletonSpecimens />
      <AsyncStateSpecimens />
      <ManySkeletons />
      <StateRule rule={uk.devUi.stateRules.skeleton} />
    </GallerySection>
  );
}
