'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchNorms } from '../api/norms';
import { analyticsKeys } from './keys';

export function useNormsQuery() {
  return useQuery({
    queryKey: analyticsKeys.norms(),
    queryFn: ({ signal }) => fetchNorms(signal),
    staleTime: Infinity,
  });
}
