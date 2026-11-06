import type { ApplicationResponse } from '@jobflow/shared';
import { useId } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { STATE_TEXT } from '@/shared/ui/state-text';

import type { ContextRow } from '../lib/context-rows';
import { useApplicationContext } from '../model/use-application-context';

export type ApplicationContextProps = Readonly<{ application: ApplicationResponse }>;

type ContextValueProps = Readonly<{ row: ContextRow }>;

const COPY = uk.applicationPage.context;

const VALUE = 'text-right font-medium tabular-nums';

function ContextValue({ row }: ContextValueProps) {
  const { value, hint } = row;
  if (hint === null) return <dd className={VALUE}>{value}</dd>;
  return (
    <dd className={VALUE}>
      {value === null ? null : <>{value} </>}
      <span className="font-normal text-ink-3">
        {value === null ? hint : COPY.afterValue(hint)}
      </span>
    </dd>
  );
}

export function ApplicationContext({ application }: ApplicationContextProps) {
  const rows = useApplicationContext(application);
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2.5 rounded-lg bg-surface-2 p-4.5 shadow-e1 inset-ring inset-ring-line-soft"
    >
      <h2 id={headingId} className={cn(STATE_TEXT.eyebrow, 'text-ink-3')}>
        {COPY.kicker}
      </h2>
      <dl className="flex flex-col gap-2 text-body">
        {rows.map((row) => (
          <div key={row.id} className="flex justify-between gap-3">
            <dt className="text-ink-3">{row.label}</dt>
            <ContextValue row={row} />
          </div>
        ))}
      </dl>
    </section>
  );
}
