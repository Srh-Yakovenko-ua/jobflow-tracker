import type { ResumeVersion } from '@jobflow/shared';

export const RESUME_PAGE_LIMITS = { visibleVersions: 5 } as const;

export type VersionsToSplit = Readonly<{
  versions: readonly ResumeVersion[];
  activeId: ResumeVersion['id'] | null;
}>;

export type VersionSplit = Readonly<{
  visible: ResumeVersion[];
  archive: ResumeVersion[];
  activeId: ResumeVersion['id'] | null;
}>;

export function splitVersions({ versions, activeId }: VersionsToSplit): VersionSplit {
  const newestFirst = [...versions].sort((left, right) => right.number - left.number);
  const active = newestFirst.find((version) => version.id === activeId && !version.isArchived);
  const others = newestFirst.filter((version) => version !== active && !version.isArchived);
  const room = RESUME_PAGE_LIMITS.visibleVersions - (active === undefined ? 0 : 1);
  const visible = [...(active === undefined ? [] : [active]), ...others.slice(0, room)];
  const archive = newestFirst.filter((version) => !visible.includes(version));
  return { visible, archive, activeId: active?.id ?? null };
}
