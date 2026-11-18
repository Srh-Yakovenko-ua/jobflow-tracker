'use client';

import { useSilenceDays } from '@/entities/user';
import { useSilentCount } from '@/features/snooze-reminder';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { LoadFailedAlert } from '@/shared/ui/banner';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { PageSkeleton } from '@/shared/ui/skeleton';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import type { NotificationFeed } from '../model/use-notification-feed';
import { NotificationDays } from './notification-days';
import type { NotificationRowContext } from './notification-row';

const COPY = uk.notifications;

function EverybodyAnswered() {
  const { eyebrow, title, hint } = COPY.empty;
  const content = {
    eyebrow,
    title,
    hint: hint(useSilenceDays()),
    footnote: COPY.silentCards(useSilentCount()),
  };
  return (
    <div className="animate-fade-in">
      <EmptyState content={content} />
    </div>
  );
}

function FeedMore({ query }: Readonly<Pick<NotificationFeed, 'query'>>) {
  const onMore = () => void query.fetchNextPage();
  if (query.isFetchNextPageError) {
    return <LoadFailedAlert onRetry={onMore} className="animate-fade-in self-center" />;
  }
  if (!query.hasNextPage) return null;
  return (
    <Button
      variant="secondary"
      loading={query.isFetchingNextPage}
      className={cn(TOUCH_HEIGHT, 'self-center')}
      onClick={onMore}
    >
      {COPY.more}
    </Button>
  );
}

export type FeedBodyProps = Readonly<{
  feed: NotificationFeed;
  context: Omit<NotificationRowContext, 'timeZone'>;
}>;

export function FeedBody({ feed, context }: FeedBodyProps) {
  const { query, days, timeZone } = feed;
  if (days === undefined) {
    if (!query.isError) return <PageSkeleton />;
    const onRetry = () => void query.refetch();
    return <LoadFailedPanel onRetry={onRetry} retrying={query.isFetching} />;
  }
  if (days.length === 0) return <EverybodyAnswered />;
  return (
    <div className="flex flex-col gap-4">
      <NotificationDays
        days={days}
        headingLevel={2}
        context={{ ...context, timeZone }}
        className="rounded-lg bg-surface p-2 shadow-e1"
      />
      <FeedMore query={query} />
    </div>
  );
}
