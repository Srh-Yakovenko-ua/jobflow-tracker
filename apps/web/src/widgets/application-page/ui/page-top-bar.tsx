'use client';

import type { ApplicationResponse } from '@jobflow/shared';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { uk } from '@/shared/i18n';
import { formatDayMonth } from '@/shared/lib/state-format';

export type ApplicationPageMode = 'page' | 'sheet';

export type PageTopBarProps = Readonly<{
  application: ApplicationResponse;
  view: { mode: ApplicationPageMode; timeZone: string | undefined };
}>;

const COPY = uk.applicationPage;

const BACK =
  'touch-target inline-flex min-h-10 items-center gap-2 rounded-sm text-[13.5px] text-ink-3 transition-colors duration-(--duration-fast) ease-standard hover:text-ink';

function BackToBoard({ mode }: Readonly<{ mode: ApplicationPageMode }>) {
  const router = useRouter();
  const label = (
    <>
      <ChevronLeft aria-hidden size={16} strokeWidth={1.9} />
      {COPY.back}
    </>
  );
  if (mode === 'sheet') {
    return (
      <button
        type="button"
        className={BACK}
        onClick={() => {
          router.back();
        }}
      >
        {label}
      </button>
    );
  }
  return (
    <Link href="/board" className={BACK}>
      {label}
    </Link>
  );
}

export function PageTopBar({ application, view }: PageTopBarProps) {
  const created = formatDayMonth({ at: new Date(application.createdAt), timeZone: view.timeZone });
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-2">
      <BackToBoard mode={view.mode} />
      <p className="eyebrow text-ink-3 tabular-nums">{COPY.created(created)}</p>
    </div>
  );
}
