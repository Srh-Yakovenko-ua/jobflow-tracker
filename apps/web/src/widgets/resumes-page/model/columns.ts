import type { ResumeVersion } from '@jobflow/shared';
import { createColumnHelper, tableFeatures } from '@tanstack/react-table';

import { missingForPercent } from '@/entities/resume';

export const versionTableFeatures = tableFeatures({});

export const VERSION_COLUMN_IDS = [
  'version',
  'applications',
  'screening',
  'conversion',
  'actions',
] as const;

export type VersionColumnId = (typeof VERSION_COLUMN_IDS)[number];

export function isVersionColumnId(id: string): id is VersionColumnId {
  return VERSION_COLUMN_IDS.some((known) => known === id);
}

const column = createColumnHelper<typeof versionTableFeatures, ResumeVersion>();

export const VERSION_COLUMNS = column.columns([
  column.accessor('title', { id: 'version' }),
  column.accessor('applicationsCount', { id: 'applications' }),
  column.accessor((version) => missingForPercent(version.applicationsCount), { id: 'screening' }),
  column.display({ id: 'conversion' }),
  column.display({ id: 'actions' }),
]);
