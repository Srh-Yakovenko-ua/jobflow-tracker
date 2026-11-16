'use client';

import { type EmailedType, emailUnsubscribeInputSchema } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ApiError } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { SETTINGS_ANCHORS, settingsHref } from '@/shared/lib/settings-anchors';
import { Banner } from '@/shared/ui/banner';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { Fade } from '@/shared/ui/fade';
import { Reveal } from '@/shared/ui/reveal';

import { useUnsubscribeEmailMutation } from '../model/use-unsubscribe';

const COPY = uk.unsubscribe;

const REFUSED_LINK_STATUSES: ReadonlySet<number> = new Set([401, 422]);

type UnsubscribeView =
  { kind: 'confirm' } | { kind: 'done'; type: EmailedType } | { kind: 'invalid' };

type UnsubscribeMutation = ReturnType<typeof useUnsubscribeEmailMutation>;

type ViewInput = { token: string | undefined; mutation: UnsubscribeMutation };

export type UnsubscribeCardProps = Readonly<{ token: string | undefined }>;

function isRefusedLink(error: Error | null): boolean {
  return error instanceof ApiError && REFUSED_LINK_STATUSES.has(error.status);
}

function viewOf({ token, mutation }: ViewInput): UnsubscribeView {
  if (!emailUnsubscribeInputSchema.safeParse({ token }).success) return { kind: 'invalid' };
  if (mutation.data !== undefined) return { kind: 'done', type: mutation.data.type };
  if (isRefusedLink(mutation.error)) return { kind: 'invalid' };
  return { kind: 'confirm' };
}

function SettingsLink() {
  return (
    <Link
      href={settingsHref(SETTINGS_ANCHORS.notifications)}
      className="inline-flex min-h-11 items-center text-link underline underline-offset-4"
    >
      {COPY.settingsLink}
    </Link>
  );
}

type ViewContent = { title: string; hint: string; action: ReactNode };

function contentOf(view: UnsubscribeView, confirm: ReactNode): ViewContent {
  if (view.kind === 'done') {
    return { title: COPY.done.title, hint: COPY.done.hint(view.type), action: <SettingsLink /> };
  }
  if (view.kind === 'invalid') return { ...COPY.invalid, action: <SettingsLink /> };
  return { title: COPY.confirm.title, hint: COPY.confirm.hint, action: confirm };
}

export function UnsubscribeCard({ token }: UnsubscribeCardProps) {
  const mutation = useUnsubscribeEmailMutation();
  const view = viewOf({ token, mutation });
  const confirm = (
    <Button
      size="lg"
      loading={mutation.isPending}
      onClick={() => {
        if (token !== undefined) mutation.mutate({ token });
      }}
    >
      {COPY.confirm.action}
    </Button>
  );
  const { title, hint, action } = contentOf(view, confirm);
  return (
    <div className="flex flex-col gap-5.5">
      <h1 className="sr-only">{COPY.pageTitle}</h1>
      <div aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <Fade key={view.kind}>
            <EmptyState
              content={{ eyebrow: COPY.eyebrow, title, hint }}
              view={{ size: 'page' }}
              slots={{ action }}
            />
          </Fade>
        </AnimatePresence>
      </div>
      <Reveal shown={view.kind === 'confirm' && mutation.isError}>
        <Banner tone="error" content={COPY.failed} />
      </Reveal>
    </div>
  );
}
