'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { notificationDaysOf, notificationListQueryOptions } from '@/entities/notification';
import { useUserTimeZone } from '@/entities/user';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { LoadingRegion } from '@/shared/ui/loading-region';
import { TextSkeleton } from '@/shared/ui/skeleton';

import { useMarkReadMutation } from '../model/use-mark-read';
import { NotificationDays } from './notification-days';

const COPY = uk.notifications;

const QUIET_TEXT = 'block px-2.5 py-4.5 text-center text-[12px] text-ink-3';

const TEXT_ACTION =
  'rounded-[6px] px-1.5 py-0.75 text-[11.5px] font-semibold text-link transition-colors duration-(--duration-instant) ease-standard hover:bg-accent-tint active:bg-accent-tint disabled:opacity-60';

export type BellPanelProps = Readonly<{ unread: number; onFollow: () => void }>;

function BellRows({ onFollow }: Readonly<{ onFollow: () => void }>) {
  const query = useQuery(notificationListQueryOptions());
  const timeZone = useUserTimeZone();
  const [now] = useState(() => new Date());
  if (query.data === undefined) {
    if (query.isError) {
      const onRetry = () => void query.refetch();
      return <LoadFailedPanel onRetry={onRetry} retrying={query.isFetching} />;
    }
    return (
      <LoadingRegion className="px-2 py-3">
        <TextSkeleton />
      </LoadingRegion>
    );
  }
  if (query.data.items.length === 0) return <p className={QUIET_TEXT}>{COPY.popoverEmpty}</p>;
  const days = notificationDaysOf({ notifications: query.data.items, zone: { now, timeZone } });
  return (
    <NotificationDays
      days={days}
      headingLevel={3}
      context={{ timeZone, onFollow }}
      className="max-h-[min(420px,60dvh)] overflow-y-auto"
    />
  );
}

export function BellPanel({ unread, onFollow }: BellPanelProps) {
  const markAll = useMarkReadMutation();
  return (
    <>
      <div className="flex items-center justify-between gap-2.5 px-2 pt-1.75 pb-1.5">
        <h2 className="text-[10.5px] font-semibold tracking-[0.12em] text-ink-3 uppercase tabular-nums">
          {COPY.popoverTitle(unread)}
        </h2>
        <button
          type="button"
          disabled={markAll.isPending}
          onClick={() => {
            markAll.mutate({ all: true });
          }}
          className={TEXT_ACTION}
        >
          {COPY.readAll}
        </button>
      </div>
      <BellRows onFollow={onFollow} />
      <Link
        href="/notifications"
        onClick={onFollow}
        className={cn(TEXT_ACTION, 'mt-1 self-center')}
      >
        {COPY.all}
      </Link>
    </>
  );
}
