'use client';

import { loginHref } from '@jobflow/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';

import { sessionQueryOptions } from '@/entities/user';
import { apiStatusOf, HTTP_STATUS, onSessionEnd } from '@/shared/api';
import { LoadFailedPanel } from '@/shared/ui/error-panel';

export type SessionGateProps = Readonly<{ fallback: ReactNode; children: ReactNode }>;

function isRefusedSession(error: Error): boolean {
  return apiStatusOf(error) === HTTP_STATUS.unauthorized;
}

export function SessionGate({ fallback, children }: SessionGateProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useQuery(sessionQueryOptions());
  useEffect(
    () =>
      onSessionEnd(() => {
        router.replace(
          loginHref(`${window.location.pathname}${window.location.search}${window.location.hash}`),
        );
      }),
    [router],
  );
  useEffect(
    () => () => {
      queryClient.clear();
    },
    [queryClient],
  );
  if (session.isSuccess) return children;
  if (session.isError && !session.isFetching && !isRefusedSession(session.error)) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="w-full max-w-120">
          <LoadFailedPanel
            onRetry={() => {
              void session.refetch();
            }}
          />
        </div>
      </div>
    );
  }
  return fallback;
}
