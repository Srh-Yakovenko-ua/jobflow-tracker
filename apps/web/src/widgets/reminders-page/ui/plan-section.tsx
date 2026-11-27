'use client';

import type { Plan } from '@jobflow/shared';
import Link from 'next/link';

import { PlanItemRow } from '@/features/toggle-plan-item';
import { uk } from '@/shared/i18n';

import type { PlanSectionState, PlanView } from '../model/use-reminders-page';
import { SectionBody, SectionFrame } from './section-frame';

const COPY = uk.reminders.plan;

const ANALYTICS_HREF = '/analytics';

export type PlanSectionProps = Readonly<{ plan: PlanSectionState }>;

function itemsInOrder(plan: Plan) {
  return [...plan.items].sort((left, right) => left.position - right.position);
}

function PlanProgress({ plan }: Readonly<{ plan: Plan }>) {
  const done = plan.items.filter((item) => item.doneAt !== null).length;
  const text = COPY.progress({ items: plan.items.length, done });
  return (
    <p role="status" aria-atomic="true" className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-semibold text-ink">{plan.title}</span>
      <span key={text} className="animate-fade-in text-[13px] text-ink-2 tabular-nums">
        {text}
      </span>
    </p>
  );
}

function PlanBody({ view }: Readonly<{ view: PlanView }>) {
  const { plan, timeZone } = view;
  if (plan === null) {
    return (
      <p className="flex animate-fade-in flex-wrap items-center gap-x-2 text-[14px] text-ink-2">
        {COPY.empty}
        <Link
          href={ANALYTICS_HREF}
          className="touch-target rounded-xs font-semibold text-link underline-offset-2 hover:underline active:underline"
        >
          {COPY.toAnalytics}
        </Link>
      </p>
    );
  }
  return (
    <div className="flex animate-fade-in flex-col gap-2.5">
      <PlanProgress plan={plan} />
      {itemsInOrder(plan).map((item) => (
        <PlanItemRow key={item.id} item={item} context={{ planId: plan.id, timeZone }} />
      ))}
    </div>
  );
}

export function PlanSection({ plan }: PlanSectionProps) {
  return (
    <SectionFrame title={COPY.title}>
      <SectionBody load={plan.load} ready={plan.view !== undefined}>
        {plan.view && <PlanBody view={plan.view} />}
      </SectionBody>
    </SectionFrame>
  );
}
