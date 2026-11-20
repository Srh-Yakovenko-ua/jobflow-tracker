import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';

export function useQueryNow(query: Pick<UseQueryResult, 'dataUpdatedAt'>): Date {
  const [mountedAt] = useState(Date.now);
  return new Date(Math.max(query.dataUpdatedAt, mountedAt));
}
