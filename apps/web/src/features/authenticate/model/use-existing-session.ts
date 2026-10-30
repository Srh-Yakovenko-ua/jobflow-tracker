import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { userKeys } from '@/entities/user';
import { refreshAccessToken } from '@/shared/api';

export type UseExistingSessionOptions = { returnTo: string; enabled: boolean };

const SIGNED_IN = 'signed-in';

export function useExistingSession({ returnTo, enabled }: UseExistingSessionOptions): void {
  const router = useRouter();
  const { isSuccess } = useQuery({
    queryKey: userKeys.cookieSession(),
    queryFn: () => refreshAccessToken().then(() => SIGNED_IN),
    gcTime: 0,
    retry: false,
    enabled,
  });
  useEffect(() => {
    if (isSuccess) router.replace(returnTo);
  }, [isSuccess, returnTo, router]);
}
