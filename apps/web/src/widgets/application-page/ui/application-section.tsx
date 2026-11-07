import { type ReactNode, useId } from 'react';

import { cn } from '@/shared/lib/cn';
import { STATE_TEXT } from '@/shared/ui/state-text';

type TitleLook = 'eyebrow' | 'display';

export type ApplicationSectionProps = Readonly<{
  title: Readonly<{ text: ReactNode; look: TitleLook }>;
  header?: Readonly<{ before?: ReactNode; after?: ReactNode; className?: string }>;
  view: Readonly<{ className: string; busy?: boolean }>;
  children: ReactNode;
}>;

const TITLE_LOOK: Readonly<Record<TitleLook, string>> = {
  eyebrow: cn(STATE_TEXT.eyebrow, 'text-ink-3'),
  display: 'font-display text-[24px] leading-[1.2] font-medium',
};

export function ApplicationSection({ title, header, view, children }: ApplicationSectionProps) {
  const headingId = useId();
  const heading = (
    <h2 id={headingId} className={TITLE_LOOK[title.look]}>
      {title.text}
    </h2>
  );
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={view.busy || undefined}
      className={view.className}
    >
      {header === undefined ? (
        heading
      ) : (
        <div className={header.className}>
          {header.before}
          {heading}
          {header.after}
        </div>
      )}
      {children}
    </section>
  );
}
