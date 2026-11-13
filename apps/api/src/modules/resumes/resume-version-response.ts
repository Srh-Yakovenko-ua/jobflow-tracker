import { AI_JOB_FAILURES, type ResumeProfileStatus, type ResumeVersion } from '@jobflow/shared';

import type { ResumeVersionRow } from './resume-versions.repository.js';

export const RESUME_VERSION_NOT_FOUND = 'Resume version not found';

function profileStatusOf({ aiProfile, aiJobs: [latest] }: ResumeVersionRow): ResumeProfileStatus {
  if (aiProfile !== null) {
    return 'done';
  }
  if (latest?.status === 'done') {
    return 'failed';
  }
  const needsText = latest?.status === 'failed' && latest.errorType === AI_JOB_FAILURES.needsText;
  return needsText ? AI_JOB_FAILURES.needsText : (latest?.status ?? 'queued');
}

export function toResumeVersion(row: ResumeVersionRow): ResumeVersion {
  const { id, number, title, note, filename, mime, sizeBytes, isArchived } = row;
  return {
    id,
    number,
    title,
    note,
    filename,
    mime,
    sizeBytes,
    isArchived,
    uploadedAt: row.uploadedAt.toISOString(),
    aiProfileStatus: profileStatusOf(row),
    applicationsCount: row._count.applications,
  };
}
