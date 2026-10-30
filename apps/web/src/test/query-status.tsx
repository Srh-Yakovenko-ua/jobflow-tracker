import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
  type QueryKey,
  type QueryStatus,
  useQueryClient,
} from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { expect } from 'vitest';

export type QueryProbeProps = Readonly<{ queryKey: QueryKey }>;

export type StaleQueryProps = QueryProbeProps & Readonly<{ data: unknown }>;

export type QuerySettle = Readonly<{ queryKey: QueryKey; status: QueryStatus | 'absent' }>;

const RETRIED_ERROR_TIMEOUT_MS = 2500;

function probeName(queryKey: QueryKey): string {
  return `query ${JSON.stringify(queryKey)}`;
}

export function QueryProbe({ queryKey }: QueryProbeProps) {
  const cache = useQueryClient().getQueryCache();
  const status = useSyncExternalStore(
    (onChange) => cache.subscribe(onChange),
    () => cache.find({ queryKey, exact: true })?.state.status ?? 'absent',
  );
  return <output aria-label={probeName(queryKey)}>{status}</output>;
}

export function StaleQuery({ queryKey, data }: StaleQueryProps) {
  const earlier = new QueryClient();
  earlier.setQueryData(queryKey, data, { updatedAt: 0 });
  return <HydrationBoundary state={dehydrate(earlier)} />;
}

export async function waitForQuery({ queryKey, status }: QuerySettle) {
  await waitFor(
    () => {
      expect(screen.getByLabelText(probeName(queryKey)).textContent).toBe(status);
    },
    { timeout: RETRIED_ERROR_TIMEOUT_MS },
  );
}
