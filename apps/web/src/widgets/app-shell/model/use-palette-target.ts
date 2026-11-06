import { applicationIdSchema, type ApplicationResponse } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { applicationQueryOptions } from '@/entities/application';
import { meQueryOptions } from '@/entities/user';

import { rememberRecentApplication } from './recent-applications';

export type PaletteTargetInput = Readonly<{
  opener: HTMLElement | null;
  open: boolean;
  viewed: ApplicationResponse | undefined;
}>;

const APPLICATION_PATH = /^\/applications\/([^/?#]+)/;

export function applicationIdOf(path: string | undefined): string | undefined {
  const parsed = applicationIdSchema.safeParse(path && APPLICATION_PATH.exec(path)?.[1]);
  return parsed.success ? parsed.data : undefined;
}

type ApplicationLookup = Readonly<{ id: string | undefined; enabled: boolean }>;

function useApplication({ id, enabled }: ApplicationLookup) {
  return useQuery({
    ...applicationQueryOptions(id ?? ''),
    enabled: enabled && id !== undefined,
  }).data;
}

export function useUserId(): string | undefined {
  return useQuery({ ...meQueryOptions(), select: (me) => me.user.id }).data;
}

export function useViewedApplication(): ApplicationResponse | undefined {
  const userId = useUserId();
  const application = useApplication({ id: applicationIdOf(usePathname()), enabled: true });
  useEffect(() => {
    if (userId === undefined || application === undefined) return;
    rememberRecentApplication({ userId, application });
  }, [userId, application]);
  return application;
}

function openerPathOf(opener: HTMLElement | null): string | undefined {
  const link = opener?.closest('a[href]');
  return link instanceof HTMLAnchorElement ? link.pathname : undefined;
}

export function usePaletteTarget({ opener, open, viewed }: PaletteTargetInput) {
  const id = applicationIdOf(openerPathOf(opener));
  const opened = useApplication({ id, enabled: open });
  return id === undefined ? viewed : opened;
}
