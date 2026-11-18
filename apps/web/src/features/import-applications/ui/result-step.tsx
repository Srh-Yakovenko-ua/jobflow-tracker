'use client';

import { AUTH_ROUTES, type ImportApplicationsResponse } from '@jobflow/shared';
import Link from 'next/link';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button, buttonLinkClasses } from '@/shared/ui/button';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { issueTextOf, lineOfRow } from '../lib/import-rows';

const COPY = uk.dataImport.result;

export type ResultStepProps = Readonly<{
  response: ImportApplicationsResponse;
  onRestart: () => void;
}>;

type ImportError = ImportApplicationsResponse['errors'][number];

function ErrorList({ errors }: Readonly<{ errors: readonly ImportError[] }>) {
  const rows = new Set(errors.map((error) => error.row)).size;
  return (
    <section aria-label={COPY.errorsTitle(rows)} className="flex flex-col gap-2">
      <h3 className="text-[14px] font-semibold text-danger tabular-nums">
        {COPY.errorsTitle(rows)}
      </h3>
      <ul className="flex flex-col gap-1.5 text-[13px] leading-[1.45] text-ink-2 tabular-nums">
        {errors.map((error) => (
          <li key={`${String(error.row)}-${error.path}-${error.message}`}>
            {`${COPY.line(lineOfRow(error.row))} · ${issueTextOf(error)}`}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ResultStep({ response, onRestart }: ResultStepProps) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <h2 className="text-[17px] leading-[1.3] font-semibold text-ink tabular-nums">
        {COPY.title(response.imported)}
      </h2>
      {response.errors.length === 0 ? (
        <p className="text-[13px] text-ink-2">{COPY.clean}</p>
      ) : (
        <ErrorList errors={response.errors} />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={AUTH_ROUTES.home}
          className={cn(buttonLinkClasses({ variant: 'primary', size: 'md' }), TOUCH_HEIGHT)}
        >
          {COPY.board}
        </Link>
        <Button variant="outline" className={TOUCH_HEIGHT} onClick={onRestart}>
          {COPY.again}
        </Button>
      </div>
    </div>
  );
}
