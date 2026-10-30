import type { MeResponse } from '@jobflow/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { clearAccessToken } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { AUTH_ROUTES } from '@/shared/lib/return-to';
import { showErrorToast } from '@/shared/ui/error-toast';

import { logout } from '../api/logout';
import { meQueryOptions } from '../api/me';

export type Session = {
  user: MeResponse['user'] | undefined;
  settings: MeResponse['settings'] | undefined;
  logout: () => void;
};

export function useSession(): Session {
  const router = useRouter();
  const me = useQuery(meQueryOptions()).data;
  const { mutate } = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearAccessToken();
      router.replace(AUTH_ROUTES.login);
    },
    onError: () => {
      showErrorToast(uk.shell.logout.failed);
    },
  });
  return {
    user: me?.user,
    settings: me?.settings,
    logout: () => {
      mutate();
    },
  };
}
