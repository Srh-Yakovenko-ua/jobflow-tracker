import type { ApplicationResponse, ContactResponse } from '@jobflow/shared';

import { mailtoOf, telegramHandleOf, telegramUrlOf } from '@/entities/contact';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { NEW_TAB } from '@/shared/lib/web-url';
import { CopyButton } from '@/shared/ui/copy-button';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

export type RecruiterDetailsProps = Readonly<{
  contact: ContactResponse;
  application: ApplicationResponse;
}>;

type LinkKind = 'email' | 'telegram';

type ContactLink = Readonly<{ href: string; text: string; newTab: boolean }>;

type LinkRowProps = Readonly<{ kind: LinkKind; link: ContactLink }>;

const COPY = uk.contact;

const LINK_KINDS = ['email', 'telegram'] as const satisfies readonly LinkKind[];

const LINKS: Record<LinkKind, (raw: string) => ContactLink> = {
  email: (email) => ({ href: mailtoOf(email), text: email, newTab: false }),
  telegram: (raw) => ({ href: telegramUrlOf(raw), text: telegramHandleOf(raw), newTab: true }),
};

const ROW = 'flex items-center justify-between gap-3';

const VALUE = 'text-[12.5px] font-semibold';

const LINK_VALUE =
  'min-w-0 text-right wrap-anywhere text-link group-hover:underline group-active:underline';

function LinkRow({ kind, link }: LinkRowProps) {
  return (
    <div
      className={cn(ROW, 'min-h-10.5 pb-2 shadow-[inset_0_-1px_0_var(--line-soft)]', TOUCH_HEIGHT)}
    >
      <a
        href={link.href}
        {...(link.newTab ? NEW_TAB : {})}
        className={cn(ROW, 'group min-w-0 flex-1 self-stretch rounded-sm')}
      >
        <span className="text-ink-3">{COPY.rows[kind]}</span>{' '}
        <span className={cn(VALUE, LINK_VALUE)}>{link.text}</span>
      </a>
      <CopyButton value={link.text} label={COPY.copy[kind]} />
    </div>
  );
}

function linkRowsOf(contact: ContactResponse) {
  return LINK_KINDS.flatMap((kind) => {
    const raw = contact[kind];
    return raw === null ? [] : [{ kind, link: LINKS[kind](raw) }];
  });
}

export function RecruiterDetails({ contact, application }: RecruiterDetailsProps) {
  const hours = contact.avgResponseHours;
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-0.75">
        <span className="text-[15px] font-semibold">{contact.name}</span>
        <span className="text-[13px] text-ink-3">
          {COPY.summary(
            contact.role === null ? [application.company] : [contact.role, application.company],
          )}
        </span>
      </div>
      <div className="flex flex-col gap-2 text-body">
        {linkRowsOf(contact).map(({ kind, link }) => (
          <LinkRow key={kind} kind={kind} link={link} />
        ))}
        {hours !== null && (
          <div className={cn(ROW, 'min-h-8.5')}>
            <span className="text-ink-3">{COPY.rows.response}</span>
            <span className={cn(VALUE, 'tabular-nums')}>{COPY.responseHours(hours)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
