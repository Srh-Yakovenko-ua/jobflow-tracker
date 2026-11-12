import type { ResumeProfileStatus } from '@jobflow/shared';
import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { DONE_DOT, FAILED_MARK, WAITING_DOT } from '@/shared/ui/async-state';

const COPY = uk.resumes.aiProfile;

type ProfileLook = { marker: ReactNode; tone?: string };

const FAILED_LOOK: ProfileLook = { marker: FAILED_MARK, tone: 'text-ink-2' };

const LOOKS: Record<ResumeProfileStatus, ProfileLook> = {
  queued: { marker: WAITING_DOT },
  processing: { marker: WAITING_DOT },
  done: { marker: DONE_DOT },
  failed: FAILED_LOOK,
  needs_text: FAILED_LOOK,
};

export type AiProfileStatusProps = Readonly<{ status: ResumeProfileStatus }>;

export function AiProfileStatus({ status }: AiProfileStatusProps) {
  const look = LOOKS[status];
  return (
    <span className={cn('inline-flex flex-none items-center gap-1.5', look.tone)}>
      {look.marker}
      <span>{COPY[status]}</span>
    </span>
  );
}
