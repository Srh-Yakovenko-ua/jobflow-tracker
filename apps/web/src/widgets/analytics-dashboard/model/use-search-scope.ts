'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { searchesQueryOptions } from '@/entities/search';

export function useSearchScope() {
  const searches = useQuery(searchesQueryOptions());
  const [selectedId, setSelectedId] = useState<string>();
  const activeId = searches.data?.items.find((search) => search.status === 'active')?.id;
  return {
    searches,
    activeId,
    selectedId,
    searchId: selectedId ?? activeId,
    select: (id: string) => {
      setSelectedId(id === activeId ? undefined : id);
    },
  };
}

export type SearchScope = ReturnType<typeof useSearchScope>;
