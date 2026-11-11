'use client';

import { type ResumeVersion, resumeVersionLabel } from '@jobflow/shared';
import type { ReactNode } from 'react';

import { formatTimelineDate } from '@/entities/application';
import { AiProfileStatus, missingForPercent } from '@/entities/resume';
import { VersionActions } from '@/features/edit-resume-version';
import { uk } from '@/shared/i18n';
import { formatFileSize } from '@/shared/lib/state-format';

import type { VersionColumnId } from '../model/columns';

const COPY = uk.resumes;

export type VersionRowView = Readonly<{ active: boolean; now: Date; timeZone: string }>;

export type VersionCellProps = Readonly<{ version: ResumeVersion; view: VersionRowView }>;

const NO_VALUE = '—';

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

function ScreeningSample({ version }: VersionCellProps) {
  const missing = missingForPercent(version.applicationsCount);
  if (missing === 0) return <span className="text-[13px] text-ink-3">{NO_VALUE}</span>;
  return (
    <span className="inline-flex h-3 items-center rounded-pill border-[1.5px] border-dashed border-line bg-surface-2 px-1.5 text-[10px] whitespace-nowrap text-ink-3">
      {COPY.needMore(missing)}
    </span>
  );
}

export const VERSION_CELLS: Record<VersionColumnId, (props: VersionCellProps) => ReactNode> = {
  version: VersionName,
  applications: ({ version }) => (
    <span className="text-[13px] font-semibold tabular-nums">{version.applicationsCount}</span>
  ),
  screening: ScreeningSample,
  conversion: () => <span className="text-[12px] font-semibold text-ink-3">{COPY.lowData}</span>,
  actions: ({ version, view }) => <VersionActions version={version} view={view} />,
};

export const END_ALIGNED: ReadonlySet<VersionColumnId> = new Set(['applications', 'conversion']);
