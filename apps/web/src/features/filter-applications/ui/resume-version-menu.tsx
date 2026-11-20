'use client';

import { type ResumeVersion, resumeVersionLabel } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { resumeVersionsQueryOptions } from '@/entities/resume';
import { uk } from '@/shared/i18n';
import { sectionLoadOf } from '@/shared/lib/section-load';
import { LoadFailedAlert } from '@/shared/ui/banner';
import { LoadingRegion } from '@/shared/ui/loading-region';
import type { ChoiceOption } from '@/shared/ui/radio-group';
import { TextSkeleton } from '@/shared/ui/skeleton';

import { useApplicationFilters } from '../model/filters-store';
import { ChoiceChecks, FilterPill } from './filter-pill';

const COPY = uk.board.filters.resumeVersion;

type PickedVersions = readonly string[] | undefined;

type PillInput = Readonly<{ picked: PickedVersions; versions: readonly ResumeVersion[] }>;

function pillLabelOf({ picked, versions }: PillInput): string {
  const [only] = picked ?? [];
  if (picked === undefined || only === undefined) {
    return COPY.pill(COPY.all);
  }
  const version = picked.length === 1 ? versions.find(({ id }) => id === only) : undefined;
  return version === undefined ? COPY.pill(String(picked.length)) : COPY.short(version.number);
}

function choicesOf({ picked, versions }: PillInput): ChoiceOption[] {
  return versions
    .filter(
      ({ id, isArchived, applicationsCount }) =>
        !isArchived || applicationsCount > 0 || picked?.includes(id) === true,
    )
    .map((version) => {
      const label = resumeVersionLabel(version);
      return { value: version.id, label: version.isArchived ? COPY.archived(label) : label };
    });
}

function VersionChoices({ picked }: Readonly<{ picked: PickedVersions }>) {
  const query = useQuery(resumeVersionsQueryOptions());
  const { toggleResumeVersion } = useApplicationFilters((store) => store.actions);
  const load = sectionLoadOf(query);
  if (load.failed) return <LoadFailedAlert load={load} />;
  if (query.data === undefined) {
    return (
      <LoadingRegion>
        <TextSkeleton />
      </LoadingRegion>
    );
  }
  const options = choicesOf({ picked, versions: query.data.items });
  if (options.length === 0) {
    return <p className="py-1 text-[12.5px] text-ink-2">{COPY.none}</p>;
  }
  return (
    <ChoiceChecks
      legend={COPY.menu}
      options={options}
      picked={picked}
      onToggle={toggleResumeVersion}
      columns={1}
    />
  );
}

export function ResumeVersionMenu() {
  const picked = useApplicationFilters((store) => store.filters.resumeVersion);
  const versions = useQuery(resumeVersionsQueryOptions()).data?.items ?? [];
  const pill = { label: pillLabelOf({ picked, versions }), picked: picked !== undefined };
  return (
    <FilterPill pill={pill} menu={COPY.menu}>
      <VersionChoices picked={picked} />
    </FilterPill>
  );
}
