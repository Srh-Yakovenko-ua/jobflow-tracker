import type { RateResult, ResumeAbVersion, ResumeVersion } from '@jobflow/shared';

export const RESUME_PAGE_LIMITS = { visibleVersions: 5 } as const;

export type ConversionsById = ReadonlyMap<ResumeVersion['id'], RateResult>;

export type VersionsToSplit = Readonly<{
  versions: readonly ResumeVersion[];
  activeId: ResumeVersion['id'] | null;
  conversions: ConversionsById;
}>;

export type VersionSplit = Readonly<{
  visible: ResumeVersion[];
  archive: ResumeVersion[];
  activeId: ResumeVersion['id'] | null;
}>;

export function conversionsById(versions: readonly ResumeAbVersion[]): ConversionsById {
  return new Map(versions.map((version) => [version.resumeVersionId, version.conversion]));
}

const UNRATED = -1;

function byConversion(conversions: ConversionsById) {
  const rankOf = (version: ResumeVersion) => {
    const conversion = conversions.get(version.id);
    return conversion?.status === 'ok' ? conversion.value : UNRATED;
  };
  return (left: ResumeVersion, right: ResumeVersion) =>
    rankOf(right) - rankOf(left) || right.number - left.number;
}

export function splitVersions({ versions, activeId, conversions }: VersionsToSplit): VersionSplit {
  const newestFirst = [...versions].sort((left, right) => right.number - left.number);
  const active = newestFirst.find((version) => version.id === activeId && !version.isArchived);
  const others = newestFirst.filter((version) => version !== active && !version.isArchived);
  const room = RESUME_PAGE_LIMITS.visibleVersions - (active === undefined ? 0 : 1);
  const shown = others.slice(0, room).sort(byConversion(conversions));
  const visible = [...(active === undefined ? [] : [active]), ...shown];
  const archive = newestFirst.filter((version) => !visible.includes(version));
  return { visible, archive, activeId: active?.id ?? null };
}
