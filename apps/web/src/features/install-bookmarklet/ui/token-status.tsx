'use client';

import type { CaptureTokenSummary } from '@jobflow/shared';

import { useUserTimeZone } from '@/entities/user';
import { uk } from '@/shared/i18n';
import { formatIncidentTime } from '@/shared/lib/state-format';

const COPY = uk.bookmarklet.status;

const PAIR = 'flex gap-1.5';

export type TokenStatusProps = Readonly<{ token: CaptureTokenSummary }>;

export function TokenStatus({ token }: TokenStatusProps) {
  const timeZone = useUserTimeZone();
  const timeOf = (iso: string) => formatIncidentTime({ at: new Date(iso), timeZone });
  return (
    <dl
      aria-label={COPY.label}
      className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] leading-[1.5] tabular-nums"
    >
      <div className={PAIR}>
        <dt className="text-ink-3">{COPY.created}</dt>
        <dd>{timeOf(token.createdAt)}</dd>
      </div>
      <div className={PAIR}>
        <dt className="text-ink-3">{COPY.lastUsed}</dt>
        <dd>{token.lastUsedAt === null ? COPY.neverUsed : timeOf(token.lastUsedAt)}</dd>
      </div>
    </dl>
  );
}
