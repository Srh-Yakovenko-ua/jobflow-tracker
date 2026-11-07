'use client';

import type { ApplicationFilters } from '@jobflow/shared';
import { hashKey } from '@tanstack/react-query';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { StoreProviderProps } from '@/shared/lib/store-context';

import { filtersAsWritten, filtersInSearch } from './application-filters';
import { FiltersStoreProvider, useApplicationFilters } from './filters-store';

function useFiltersFollowUrl() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [home] = useState(pathname);
  const filters = useApplicationFilters((store) => store.filters);
  const { follow } = useApplicationFilters((store) => store.actions);
  useEffect(() => {
    if (pathname !== home) {
      return;
    }
    const inUrl = filtersInSearch(window.location.search);
    if (hashKey([inUrl]) !== hashKey([filtersAsWritten(filters)])) {
      follow(inUrl);
    }
  }, [pathname, home, searchParams, filters, follow]);
}

function FollowUrl() {
  useFiltersFollowUrl();
  return null;
}

export function ApplicationFiltersProvider({
  initial,
  children,
}: StoreProviderProps<ApplicationFilters>) {
  return (
    <FiltersStoreProvider initial={initial}>
      <FollowUrl />
      {children}
    </FiltersStoreProvider>
  );
}
