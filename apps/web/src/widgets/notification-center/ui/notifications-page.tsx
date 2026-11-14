'use client';

import type { NotificationFilter } from '@/entities/notification';
import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { useMarkReadMutation } from '../model/use-mark-read';
import { useNotificationFeed } from '../model/use-notification-feed';
import { FeedBody } from './feed-body';

const COPY = uk.notifications;

const FILTERS = (['all', 'unread'] as const).map((value: NotificationFilter) => ({
  value,
  label: COPY.filters.options[value],
}));

export function NotificationsPage() {
  const feed = useNotificationFeed();
  const markAll = useMarkReadMutation();
  return (
    <section className="flex max-w-180 min-w-0 flex-col gap-6">
      <h1 className="font-display text-[clamp(26px,3.5vw,36px)] leading-[1.03] font-medium tracking-[-0.036em] text-ink">
        {COPY.title}
      </h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          aria-label={COPY.filters.label}
          options={FILTERS}
          value={feed.filter.value}
          onValueChange={feed.filter.set}
        />
        <Button
          variant="ghost"
          size="sm"
          loading={markAll.isPending}
          className={TOUCH_HEIGHT}
          onClick={() => {
            markAll.mutate({ all: true });
          }}
        >
          {COPY.readAll}
        </Button>
      </div>
      <FeedBody feed={feed} />
    </section>
  );
}
