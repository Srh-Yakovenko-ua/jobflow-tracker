import type { ApplicationCard } from '@jobflow/shared';
import type { ReactNode } from 'react';

export type CardHeadingProps = Readonly<{ application: ApplicationCard; badge: ReactNode }>;

export function CardHeading({ application, badge }: CardHeadingProps) {
  return (
    <div className="flex items-start justify-between gap-2.5">
      <div className="flex min-w-0 flex-col gap-0.75">
        <span className="text-[14.5px] leading-[1.32] font-semibold tracking-[-0.01em] wrap-anywhere">
          {application.position}
        </span>
        <span title={application.company} className="truncate text-[12.5px] text-ink-3">
          {application.company}
        </span>
      </div>
      {badge}
    </div>
  );
}
