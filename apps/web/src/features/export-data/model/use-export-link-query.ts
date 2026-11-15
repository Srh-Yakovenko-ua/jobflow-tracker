'use client';

import type { ExportLink } from '@jobflow/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { exportLinkQueryOptions, isExportStalled } from '../api/export-data';

export function useExportLinkQuery(exportId: string | null) {
  const options = exportLinkQueryOptions(exportId);
  const link = useQuery(options);
  const cache = useQueryClient().getQueryCache();
  const stalled = useSyncExternalStore(
    (onChange) => cache.subscribe(onChange),
    () => isExportStalled(cache.find<ExportLink>({ queryKey: options.queryKey })?.state),
    () => false,
  );
  return { link, stalled };
}
