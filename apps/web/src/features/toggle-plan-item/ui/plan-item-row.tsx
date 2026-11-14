'use client';

import type { Plan, PlanItem } from '@jobflow/shared';
import { useId } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatDayMonth } from '@/shared/lib/state-format';
import { Checkbox } from '@/shared/ui/checkbox';

import { useTogglePlanItemMutation } from '../model/use-toggle-plan-item-mutation';

const COPY = uk.reminders.plan;

export type PlanItemContext = Readonly<{ planId: Plan['id']; timeZone: string }>;

export type PlanItemRowProps = Readonly<{ item: PlanItem; context: PlanItemContext }>;

function DueDate({ item, context }: PlanItemRowProps) {
  if (item.dueAt === null) return null;
  const day = formatDayMonth({ at: new Date(item.dueAt), timeZone: context.timeZone });
  return (
    <span className="text-[12.5px] font-semibold text-ink-2 tabular-nums">{COPY.due(day)}</span>
  );
}

export function PlanItemRow({ item, context }: PlanItemRowProps) {
  const toggle = useTogglePlanItemMutation();
  const detailsId = useId();
  const done = item.doneAt !== null;
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-surface px-4 py-2 shadow-e1">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <Checkbox
          checked={done}
          aria-describedby={detailsId}
          onCheckedChange={(checked) => {
            toggle.mutate({
              planId: context.planId,
              itemId: item.id,
              patch: { done: checked === true },
            });
          }}
          label={
            <span
              className={cn(
                'font-semibold wrap-break-word transition-colors duration-(--duration-instant) ease-standard',
                done ? 'text-ink-2' : 'text-ink',
              )}
            >
              {item.title}
            </span>
          }
        />
        <DueDate item={item} context={context} />
      </div>
      <div
        id={detailsId}
        className="flex flex-col gap-0.5 pb-1 pl-7 text-[13px] leading-[1.5] text-ink-2"
      >
        {item.why !== null && <p className="wrap-break-word">{item.why}</p>}
        {item.expectedEffect !== null && <p className="wrap-break-word">{item.expectedEffect}</p>}
      </div>
    </div>
  );
}
