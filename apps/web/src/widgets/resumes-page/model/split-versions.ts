import type { ResumeAbVersion, ResumeVersion } from '@jobflow/shared';

import { conversionOf } from '@/entities/resume';

export const RESUME_PAGE_LIMITS = { visibleVersions: 5 } as const;

export type VersionsToSplit = Readonly<{
  versions: readonly ResumeVersion[];
  activeId: ResumeVersion['id'] | null;
  abVersions: readonly ResumeAbVersion[] | undefined;
}>;

export type VersionSplit = Readonly<{
  visible: ResumeVersion[];
  archive: ResumeVersion[];
  activeId: ResumeVersion['id'] | null;
}>;

const UNRATED = -1;

function byConversion(abVersions: VersionsToSplit['abVersions']) {
  const rankOf = (version: ResumeVersion) => {
    const conversion = conversionOf({ versions: abVersions, versionId: version.id });
    return typeof conversion !== 'string' && conversion.status === 'ok'
      ? conversion.value
      : UNRATED;
  };
  return (left: ResumeVersion, right: ResumeVersion) =>
    rankOf(right) - rankOf(left) || right.number - left.number;
}

export function splitVersions({ versions, activeId, abVersions }: VersionsToSplit): VersionSplit {
  const newestFirst = [...versions].sort((left, right) => right.number - left.number);
  const active = newestFirst.find((version) => version.id === activeId && !version.isArchived);
  const others = newestFirst.filter((version) => version !== active && !version.isArchived);
  const room = RESUME_PAGE_LIMITS.visibleVersions - (active === undefined ? 0 : 1);
  const shown = others.slice(0, room).sort(byConversion(abVersions));
  const visible = [...(active === undefined ? [] : [active]), ...shown];
  const archive = newestFirst.filter((version) => !visible.includes(version));
  return { visible, archive, activeId: active?.id ?? null };
}
