'use client';

import { type ApplicationResponse, AUTH_ROUTES } from '@jobflow/shared';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { uk } from '@/shared/i18n';
import { formatDayMonth } from '@/shared/lib/state-format';
import { SheetClose } from '@/shared/ui/sheet';

export type ApplicationPageMode = 'page' | 'sheet';

export type ApplicationOrigin = 'board' | 'table' | 'calendar';

export type PageTopBarProps = Readonly<{
  application: ApplicationResponse;
  view: { mode: ApplicationPageMode; origin: ApplicationOrigin; timeZone: string | undefined };
}>;

type BackLinkProps = Readonly<{ mode: ApplicationPageMode; origin: ApplicationOrigin }>;

const COPY = uk.applicationPage;

const BACK_HREF: Record<ApplicationOrigin, string> = {
  board: AUTH_ROUTES.home,
  table: '/applications',
  calendar: '/calendar',
};

const BACK =
  'touch-target inline-flex min-h-10 items-center gap-2 rounded-sm text-[13.5px] text-ink-3 transition-colors duration-(--duration-fast) ease-standard hover:text-ink active:text-ink';

function BackLink({ mode, origin }: BackLinkProps) {
  const label = (
    <>
      <ChevronLeft aria-hidden size={16} strokeWidth={1.9} />
      {COPY.back[origin]}
    </>
  );
  if (mode === 'sheet') {
    return (
      <SheetClose asChild>
        <button type="button" className={BACK}>
          {label}
        </button>
      </SheetClose>
    );
  }
  return (
    <Link href={BACK_HREF[origin]} className={BACK}>
      {label}
    </Link>
  );
}

export function PageTopBar({ application, view }: PageTopBarProps) {
  const created = formatDayMonth({ at: new Date(application.createdAt), timeZone: view.timeZone });
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-2">
      <BackLink mode={view.mode} origin={view.origin} />
      <p className="eyebrow text-ink-3 tabular-nums">{COPY.created(created)}</p>
    </div>
  );
}
