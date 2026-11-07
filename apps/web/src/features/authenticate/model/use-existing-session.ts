import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { userKeys } from '@/entities/user';
import { refreshAccessToken } from '@/shared/api';
import { hasSessionCookie } from '@/shared/lib/session-cookie';

export type UseExistingSessionOptions = { returnTo: string; enabled: boolean };

const SIGNED_IN = 'signed-in';

export function useExistingSession({ returnTo, enabled }: UseExistingSessionOptions): void {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSuccess } = useQuery({
    queryKey: userKeys.cookieSession(),
    queryFn: () => refreshAccessToken().then(() => SIGNED_IN),
    staleTime: 'static',
    retry: false,
    retryOnMount: false,
    enabled: () => enabled && hasSessionCookie(),
  });
  useEffect(() => {
    if (!isSuccess) return;
    queryClient.removeQueries({ queryKey: userKeys.cookieSession() });
    router.replace(returnTo);
  }, [isSuccess, queryClient, returnTo, router]);
}
