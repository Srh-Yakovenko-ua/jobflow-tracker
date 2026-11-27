import type { ResumeProfileStatus } from '@jobflow/shared';

const PROFILE_READING: ReadonlySet<ResumeProfileStatus | undefined> = new Set([
  'queued',
  'processing',
]);

export function isProfileReading(status: ResumeProfileStatus | undefined): boolean {
  return PROFILE_READING.has(status);
}
