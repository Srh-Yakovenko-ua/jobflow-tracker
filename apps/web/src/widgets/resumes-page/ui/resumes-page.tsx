'use client';

import { useQuery } from '@tanstack/react-query';

import { resumeAbQueryOptions, resumeVersionsQueryOptions } from '@/entities/resume';
import { useSession, useUserTimeZone } from '@/entities/user';
import { ResumeUpload } from '@/features/upload-resume';
import { uk } from '@/shared/i18n';
import { sectionLoadOf } from '@/shared/lib/section-load';
import { useQueryNow } from '@/shared/lib/use-query-now';
import { Button } from '@/shared/ui/button';
import { type FilePicker, useFilePicker } from '@/shared/ui/drop-zone';
import { EmptyState } from '@/shared/ui/empty-state';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { FailedReadAlert } from '@/shared/ui/failed-read-alert';
import { LoadingRegion } from '@/shared/ui/loading-region';
import { PAGE_TITLE } from '@/shared/ui/page-title';
import { TableSkeleton } from '@/shared/ui/skeleton';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { splitVersions } from '../model/split-versions';
import { VersionsTable } from './versions-table';

const COPY = uk.resumes;

function useResumeVersions() {
  const query = useQuery(resumeVersionsQueryOptions());
  const activeId = useSession().settings?.activeResumeVersionId ?? null;
  const timeZone = useUserTimeZone();
  const now = useQueryNow(query);
  const abQuery = useQuery(resumeAbQueryOptions());
  const abVersions = abQuery.data?.versions;
  return {
    query,
    load: sectionLoadOf(query),
    activeId,
    abLoad: sectionLoadOf(abQuery),
    view: { now, timeZone, abVersions },
  };
}

function PageHeading({ picker }: Readonly<{ picker: FilePicker | null }>) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex flex-col gap-2">
        <h2 className={PAGE_TITLE}>{COPY.title}</h2>
        <p className="max-w-[56ch] text-[15.5px] leading-[1.55] text-ink-2">{COPY.lead}</p>
      </div>
      {picker !== null && (
        <Button size="lg" className={TOUCH_HEIGHT} onClick={picker.open}>
          {COPY.uploadAction}
        </Button>
      )}
    </div>
  );
}

function VersionsBody({ picker }: Readonly<{ picker: FilePicker }>) {
  const { query, load, activeId, abLoad, view } = useResumeVersions();
  if (query.data === undefined) {
    if (load.failed) return <LoadFailedPanel onRetry={load.onRetry} retrying={load.retrying} />;
    return (
      <LoadingRegion className="bg-surface shadow-e1">
        <TableSkeleton />
      </LoadingRegion>
    );
  }
  if (query.data.items.length === 0) {
    return (
      <EmptyState
        content={COPY.empty.content}
        slots={{ figure: <ResumeUpload view={{ size: 'full' }} picker={picker} /> }}
      />
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <FailedReadAlert load={abLoad} />
      <VersionsTable
        split={splitVersions({
          versions: query.data.items,
          activeId,
          abVersions: view.abVersions,
        })}
        view={view}
      />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] items-start gap-6">
        <ResumeUpload view={{ size: 'panel' }} picker={picker} />
      </div>
    </div>
  );
}

export function ResumesPage() {
  const picker = useFilePicker();
  const loaded = useQuery(resumeVersionsQueryOptions()).isSuccess;
  return (
    <section className="flex min-w-0 flex-col gap-6">
      <PageHeading picker={loaded ? picker : null} />
      <VersionsBody picker={picker} />
    </section>
  );
}
