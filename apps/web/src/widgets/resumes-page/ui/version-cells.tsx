'use client';

import { type RateResult, type ResumeVersion, resumeVersionLabel } from '@jobflow/shared';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import { formatTimelineDate } from '@/entities/application';
import { AiProfileStatus, missingForPercent } from '@/entities/resume';
import { VersionActions } from '@/features/edit-resume-version';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatFileSize } from '@/shared/lib/state-format';
import { useDataTransition } from '@/shared/lib/use-data-transition';

import type { VersionColumnId } from '../model/columns';

const COPY = uk.resumes;

export type VersionRowView = Readonly<{
  active: boolean;
  now: Date;
  timeZone: string;
  conversion: RateResult | null;
}>;

export type VersionCellProps = Readonly<{ version: ResumeVersion; view: VersionRowView }>;

const NO_VALUE = '—';

const PERCENT = 100;

type Rated = Extract<RateResult, { status: 'ok' }>;

type RatedCellProps = Readonly<{ rate: Rated; active: boolean }>;

function percentOf(rate: Rated): number {
  return Math.round(rate.value * PERCENT);
}

type MetaItemProps = Readonly<{ children: ReactNode; className?: string }>;

function MetaItem({ children, className }: MetaItemProps) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span aria-hidden>·</span>
      <span className={className}>{children}</span>
    </span>
  );
}

function VersionName({ version, view }: VersionCellProps) {
  const label = resumeVersionLabel(version);
  const uploaded = formatTimelineDate({ ...view, at: new Date(version.uploadedAt) });
  return (
    <div className="flex min-w-0 flex-col gap-0.75">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.25 gap-y-0.75">
        <span title={label} className="min-w-0 truncate text-[15.5px] font-semibold text-ink">
          {label}
        </span>
        {view.active && (
          <span className="flex-none rounded-[9px] px-1.75 py-px text-[11px] font-semibold text-accent-ink inset-ring inset-ring-accent">
            {COPY.active}
          </span>
        )}
      </div>
      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold text-ink-3">
        <span className="flex-none">{uploaded}</span>
        <MetaItem className="min-w-0 truncate">{version.filename}</MetaItem>
        <MetaItem className="tabular-nums">{formatFileSize(version.sizeBytes)}</MetaItem>
        <MetaItem>
          <AiProfileStatus status={version.aiProfileStatus} />
        </MetaItem>
      </span>
    </div>
  );
}

function NeedMore({ missing }: Readonly<{ missing: number }>) {
  if (missing === 0) return <span className="text-[13px] text-ink-3">{NO_VALUE}</span>;
  return (
    <span className="inline-flex h-3 items-center rounded-pill border-[1.5px] border-dashed border-line bg-surface-2 px-1.5 text-[10px] whitespace-nowrap text-ink-3">
      {COPY.needMore(missing)}
    </span>
  );
}

function ScreeningBar({ rate, active }: RatedCellProps) {
  const transition = useDataTransition();
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-3 rounded-pill',
        active ? 'bg-surface p-px inset-ring inset-ring-line' : 'bg-line-soft',
      )}
    >
      <span className="flex flex-1 overflow-hidden rounded-pill">
        <motion.span
          data-conversion-bar
          className={cn('block h-full w-full rounded-pill', active ? 'bg-data-2' : 'bg-data-6')}
          initial={{ x: '-100%' }}
          animate={{ x: `${String(percentOf(rate) - PERCENT)}%` }}
          transition={transition}
        />
      </span>
    </span>
  );
}

function ScreeningCell({ version, view }: VersionCellProps) {
  const { conversion } = view;
  if (conversion?.status === 'ok') return <ScreeningBar rate={conversion} active={view.active} />;
  if (conversion === null)
    return <NeedMore missing={missingForPercent(version.applicationsCount)} />;
  return <NeedMore missing={conversion.need} />;
}

function ConversionCell({ view }: VersionCellProps) {
  const { conversion } = view;
  if (conversion?.status !== 'ok') {
    return <span className="text-[12px] font-semibold text-ink-3">{COPY.lowData}</span>;
  }
  return (
    <span
      className={cn(
        'text-[15px] font-semibold tabular-nums',
        view.active ? 'text-ink' : 'text-ink-3',
      )}
    >
      {COPY.percent(percentOf(conversion))}
    </span>
  );
}

export const VERSION_CELLS: Record<VersionColumnId, (props: VersionCellProps) => ReactNode> = {
  version: VersionName,
  applications: ({ version }) => (
    <span className="text-[13px] font-semibold tabular-nums">{version.applicationsCount}</span>
  ),
  screening: ScreeningCell,
  conversion: ConversionCell,
  actions: ({ version, view }) => <VersionActions version={version} view={view} />,
};

export const END_ALIGNED: ReadonlySet<VersionColumnId> = new Set(['applications', 'conversion']);
