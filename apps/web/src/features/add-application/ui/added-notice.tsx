'use client';

import { type PossibleDuplicate, STAGE_LABELS } from '@jobflow/shared';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { formatTimelineDate } from '@/entities/application';
import { useUserTimeZone } from '@/entities/user';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Banner } from '@/shared/ui/banner';
import { Button, buttonLinkClasses } from '@/shared/ui/button';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import type { AddedApplication } from '../model/use-add-application';

export type AddedNoticeProps = Readonly<{
  added: AddedApplication;
  actions: { onAddAnother: () => void };
}>;

type DuplicateWarningProps = Readonly<{ duplicates: readonly PossibleDuplicate[] }>;

type DuplicateMeta = Readonly<{ duplicate: PossibleDuplicate; now: Date; timeZone: string }>;

const COPY = uk.add.added;

const DUPLICATES = uk.add.duplicates;

function metaOf({ duplicate, now, timeZone }: DuplicateMeta): string {
  const stage = STAGE_LABELS[duplicate.stage].labelUk;
  if (duplicate.appliedAt === null) return stage;
  const applied = formatTimelineDate({ at: new Date(duplicate.appliedAt), now, timeZone });
  return `${stage} · ${DUPLICATES.applied(applied)}`;
}

function DuplicateWarning({ duplicates }: DuplicateWarningProps) {
  const timeZone = useUserTimeZone();
  const [now] = useState(() => new Date());
  return (
    <Banner
      tone="info"
      content={{
        title: DUPLICATES.title,
        description: (
          <>
            <span className="block">{DUPLICATES.hint}</span>
            {duplicates.map((duplicate) => (
              <span key={duplicate.id} className="flex flex-wrap items-center gap-x-2">
                <Link
                  href={`/applications/${duplicate.id}`}
                  className={cn(
                    'inline-flex items-center wrap-anywhere text-link underline underline-offset-4',
                    TOUCH_HEIGHT,
                  )}
                >
                  {`${duplicate.company} · ${duplicate.position}`}
                </Link>
                <span className="tabular-nums">{metaOf({ duplicate, now, timeZone })}</span>
              </span>
            ))}
          </>
        ),
      }}
    />
  );
}

export function AddedNotice({ added, actions }: AddedNoticeProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-[15px] leading-[1.4] font-semibold text-ink">
        <Check aria-hidden size={16} strokeWidth={1.9} className="flex-none text-link" />
        {COPY.title}
      </p>
      {added.possibleDuplicates.length > 0 && (
        <DuplicateWarning duplicates={added.possibleDuplicates} />
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button autoFocus size="lg" className={TOUCH_HEIGHT} onClick={actions.onAddAnother}>
          {COPY.another}
        </Button>
        <Link
          href="/board"
          className={cn(buttonLinkClasses({ variant: 'outline', size: 'lg' }), TOUCH_HEIGHT)}
        >
          {COPY.toBoard}
        </Link>
      </div>
    </div>
  );
}
