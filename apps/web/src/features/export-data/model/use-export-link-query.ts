'use client';

import { useQuery } from '@tanstack/react-query';

import { exportLinkQueryOptions } from '../api/export-data';

export function useExportLinkQuery(exportId: string | null) {
  return useQuery(exportLinkQueryOptions(exportId));
}
