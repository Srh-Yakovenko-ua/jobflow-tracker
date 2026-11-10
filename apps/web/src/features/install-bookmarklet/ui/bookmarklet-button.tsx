'use client';

import { bookmarkletHref } from '@jobflow/bookmarklet';
import type { CaptureTokenCreated } from '@jobflow/shared';
import { ArrowUp, Plus } from 'lucide-react';
import { type MouseEvent, useState } from 'react';

import { config } from '@/shared/config';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { buttonLinkClasses } from '@/shared/ui/button';
import { CopyButton } from '@/shared/ui/copy-button';
import { showToast } from '@/shared/ui/toast';

const COPY = uk.bookmarklet;

const CLICKED_TOAST = { id: 'bookmarklet-clicked-toast' } as const;

const LINK = cn(
  buttonLinkClasses({ variant: 'primary', size: 'md' }),
  'h-auto animate-spring-in cursor-grab px-3.5 py-2.5 text-[14px] leading-[1.5] active:cursor-grabbing',
);

const HINT =
  'col-start-1 row-start-1 flex items-center gap-1.5 transition-opacity duration-(--duration-fast) ease-standard';

function sayToDrag(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  showToast({ tone: 'info', title: COPY.clicked }, CLICKED_TOAST);
}

export type BookmarkletButtonProps = Readonly<{ token: CaptureTokenCreated['token'] }>;

export function BookmarkletButton({ token }: BookmarkletButtonProps) {
  const [dragging, setDragging] = useState(false);
  const href = bookmarkletHref({
    token,
    apiUrl: config.apiUrl,
    webUrl: window.location.origin,
  });
  return (
    <div data-dragging={dragging} className="group flex flex-col items-start gap-2.5">
      <a
        ref={(anchor) => {
          anchor?.setAttribute('href', href);
        }}
        draggable
        className={LINK}
        onClick={sayToDrag}
        onDragStart={() => {
          setDragging(true);
        }}
        onDragEnd={() => {
          setDragging(false);
        }}
      >
        <Plus aria-hidden size={16} strokeWidth={1.9} />
        {COPY.button}
      </a>
      <p className="grid animate-fade-in text-[12px] leading-[1.45] text-ink-2">
        <span aria-hidden={dragging} className={cn(HINT, 'group-data-[dragging=true]:opacity-0')}>
          <ArrowUp aria-hidden size={16} strokeWidth={1.9} />
          {COPY.hint.drag}
        </span>
        <span
          aria-hidden={!dragging}
          className={cn(HINT, 'opacity-0 group-data-[dragging=true]:opacity-100')}
        >
          {COPY.hint.drop}
        </span>
      </p>
      <div className="flex items-start gap-2 text-[12px] leading-[1.45] text-ink-2">
        <CopyButton value={href} label={COPY.manual.copy} />
        <p className="pt-0.75">{COPY.manual.hint}</p>
      </div>
    </div>
  );
}
