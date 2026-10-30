'use client';

import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { CrashBoundary } from '@/shared/ui/crash-boundary';
import { CrashPanel } from '@/shared/ui/crash-panel';
import {
  AiQueuePanel,
  FileTooBigPanel,
  LoadFailedPanel,
  OfflinePanel,
} from '@/shared/ui/error-panel';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { GallerySection, Specimen, STATE_GRID, StateRule } from './gallery';
import {
  AI_QUEUE_LOAD,
  CRASH_INCIDENT,
  OFFLINE_SYNCED_AT,
  OVERSIZED_RESUME,
  specimenNoop,
  STATE_TIME_ZONE,
} from './state-specimens';

const COPY = uk.devUi.errorPanels;

const DEMO = COPY.crashDemo;

function ErrorPanels() {
  return (
    <div className={STATE_GRID}>
      <OfflinePanel
        lastSyncedAt={OFFLINE_SYNCED_AT}
        timeZone={STATE_TIME_ZONE}
        onRetry={specimenNoop}
      />
      <AiQueuePanel queue={AI_QUEUE_LOAD} />
      <FileTooBigPanel file={OVERSIZED_RESUME} onPick={specimenNoop} />
      <LoadFailedPanel onRetry={specimenNoop} />
      <div className="min-w-0 md:col-span-2">
        <CrashPanel
          incident={CRASH_INCIDENT}
          view={{ scope: 'page', timeZone: STATE_TIME_ZONE }}
          onRetry={specimenNoop}
        />
      </div>
    </div>
  );
}

function FragileWidget({ broken }: Readonly<{ broken: boolean }>) {
  if (broken) throw new Error('the /dev/ui crash demo widget was broken on purpose');
  return <p className="body bg-surface p-5.5 text-ink-2 shadow-e1">{DEMO.widget}</p>;
}

function CrashDemo() {
  const [broken, setBroken] = useState(false);
  return (
    <Specimen eyebrow={DEMO.eyebrow}>
      <Button
        variant="secondary"
        className={cn('w-fit', TOUCH_HEIGHT)}
        onClick={() => {
          setBroken(true);
        }}
      >
        {DEMO.break}
      </Button>
      <CrashBoundary
        onReset={() => {
          setBroken(false);
        }}
      >
        <FragileWidget broken={broken} />
      </CrashBoundary>
    </Specimen>
  );
}

export function ErrorStatesSection() {
  return (
    <GallerySection header={COPY}>
      <ErrorPanels />
      <CrashDemo />
      <StateRule rule={uk.devUi.stateRules.error} />
    </GallerySection>
  );
}
