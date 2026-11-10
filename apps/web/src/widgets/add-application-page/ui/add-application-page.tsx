'use client';

import type { ReactNode } from 'react';

import { addPrefillOf, type AddQuery, ManualForm, PasteForm } from '@/features/add-application';
import { InstallBookmarklet } from '@/features/install-bookmarklet';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { STATE_TEXT } from '@/shared/ui/state-text';

import { AddExplainer } from './add-explainer';

export type AddApplicationPageProps = Readonly<{ query: AddQuery }>;

type PanelTone = 'accent' | 'plain' | 'quiet';

type PanelHeading = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
}>;

type PanelProps = Readonly<{ heading: PanelHeading; tone: PanelTone; children: ReactNode }>;

const COPY = uk.add;

const PANEL_TONE: Record<PanelTone, string> = {
  accent: 'bg-surface inset-ring inset-ring-accent/25',
  plain: 'bg-surface',
  quiet: 'bg-surface-2 inset-ring inset-ring-line-soft',
};

function Panel({ heading, tone, children }: PanelProps) {
  return (
    <section
      aria-label={heading.title}
      className={cn('flex min-w-0 flex-col gap-4 rounded-lg p-5.5 shadow-e1', PANEL_TONE[tone])}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={cn('text-ink-3', STATE_TEXT.eyebrow)}>{heading.eyebrow}</p>
        {heading.badge !== undefined && (
          <span className="rounded-md px-1.75 py-0.5 text-[11.5px] leading-[1.4] font-semibold text-link inset-ring inset-ring-accent">
            {heading.badge}
          </span>
        )}
      </div>
      <h2 className="font-display text-[22px] leading-[1.2] font-medium">{heading.title}</h2>
      <p className="text-[14px] leading-[1.55] text-ink-2">{heading.description}</p>
      {children}
    </section>
  );
}

function PageHeading() {
  const [first, second] = COPY.headline;
  return (
    <header className="flex flex-col gap-3">
      <p className="eyebrow text-ink-3">{COPY.eyebrow}</p>
      <h1 className="font-display text-[clamp(28px,4vw,40px)] leading-[1.03] font-medium tracking-[-0.036em] text-ink">
        <span className="block">{first}</span> <span className="block">{second}</span>
      </h1>
      <p className="max-w-[60ch] text-[16px] leading-[1.55] text-ink-2">{COPY.lead}</p>
    </header>
  );
}

export function AddApplicationPage({ query }: AddApplicationPageProps) {
  const prefill = addPrefillOf(query);
  return (
    <div className="mx-auto flex w-full max-w-[1180px] animate-fade-in flex-col gap-10 pt-2.5 pb-16">
      <PageHeading />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] items-start gap-5">
        <Panel heading={COPY.bookmarklet} tone="accent">
          <InstallBookmarklet />
          <p className={STATE_TEXT.meta}>{COPY.bookmarklet.footnote}</p>
        </Panel>
        <Panel heading={COPY.paste} tone="plain">
          <PasteForm prefill={prefill} />
        </Panel>
        <Panel heading={COPY.manual} tone="quiet">
          <ManualForm />
        </Panel>
      </div>
      <AddExplainer />
    </div>
  );
}
