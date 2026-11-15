import type { MeResponse } from '@jobflow/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { clearAccessToken } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { AUTH_ROUTES } from '@/shared/lib/return-to';
import { showErrorToast } from '@/shared/ui/error-toast';

import { logout } from '../api/logout';
import { meQueryOptions } from '../api/me';
import { forgetUserStorage } from '../lib/user-storage';

export type Session = {
  user: MeResponse['user'] | undefined;
  settings: MeResponse['settings'] | undefined;
  logout: () => void;
  logoutEverywhere: () => void;
};

export function useEndSession(): () => void {
  const router = useRouter();
  const me = useQuery(meQueryOptions()).data;
  return () => {
    if (me !== undefined) forgetUserStorage(me.user.id);
    clearAccessToken();
    router.replace(AUTH_ROUTES.login);
  };
}

export function useSession(): Session {
  const me = useQuery(meQueryOptions()).data;
  const endSession = useEndSession();
  const { mutate } = useMutation({
    mutationFn: logout,
    onSuccess: endSession,
    onError: () => {
      showErrorToast(uk.shell.logout.failed);
    },
  });
  return {
    user: me?.user,
    settings: me?.settings,
    logout: () => {
      mutate('this');
    },
    logoutEverywhere: () => {
      mutate('all');
    },
  };
}
