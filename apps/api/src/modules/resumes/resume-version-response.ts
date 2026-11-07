import type { ResumeVersion } from '@jobflow/shared';

import type { ResumeVersionRow } from './resume-versions.repository.js';

export const RESUME_VERSION_NOT_FOUND = 'Resume version not found';

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
    aiProfileStatus: row.aiProfile !== null ? 'done' : (row.aiJobs[0]?.status ?? 'queued'),
    applicationsCount: row._count.applications,
  };
}
