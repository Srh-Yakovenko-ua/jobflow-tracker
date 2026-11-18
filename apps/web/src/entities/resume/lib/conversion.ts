import type { RateResult, ResumeAbVersion, ResumeVersion } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

export type VersionConversion = RateResult | 'none' | 'unknown';

export type ConversionQuery = Readonly<{
  versions: readonly ResumeAbVersion[] | undefined;
  versionId: ResumeVersion['id'];
}>;

type Rated = Extract<RateResult, { status: 'ok' }>;

const PERCENT = 100;

export function percentOf(rate: Rated): number {
  return Math.round(rate.value * PERCENT);
}

export function conversionOf({ versions, versionId }: ConversionQuery): VersionConversion {
  if (versions === undefined) return 'unknown';
  return versions.find((version) => version.resumeVersionId === versionId)?.conversion ?? 'none';
}

export function conversionLabelOf(conversion: VersionConversion): string {
  if (conversion === 'unknown') return uk.analytics.noValue;
  if (conversion !== 'none' && conversion.status === 'ok') {
    return uk.resumes.percent(percentOf(conversion));
  }
  return uk.resumes.lowData;
}
