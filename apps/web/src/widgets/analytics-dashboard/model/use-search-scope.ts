'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { activeSearchOf, searchesQueryOptions } from '@/entities/search';

export function useSearchScope(initialId?: string) {
  const searches = useQuery(searchesQueryOptions());
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId);
  const activeId = activeSearchOf(searches.data?.items ?? [])?.id;
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
