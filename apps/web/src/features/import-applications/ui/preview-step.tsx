'use client';

import { IMPORT_FIELD_LABELS, IMPORT_FIELDS } from '@jobflow/shared';
import { Check, CircleAlert } from 'lucide-react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { previewOf, type PreviewRow, validCountOf } from '../lib/import-rows';
import type { ImportStep, ImportWizardModel } from '../model/use-import-wizard';
import { StepHeading } from './step-heading';

const COPY = uk.dataImport.preview;

const CELL = 'px-3 py-2.5 text-left align-top';

export type PreviewStepProps = Readonly<{
  step: Extract<ImportStep, { name: 'preview' }>;
  model: Readonly<{
    importing: boolean;
    actions: Pick<ImportWizardModel['actions'], 'map' | 'submit'>;
  }>;
}>;

function RowCheck({ row }: Readonly<{ row: PreviewRow }>) {
  if (row.valid) {
    return (
      <span className="flex items-center gap-1.5 text-offer">
        <Check aria-hidden size={16} strokeWidth={1.9} />
        {COPY.ready}
      </span>
    );
  }
  return (
    <ul className="flex max-w-60 flex-col gap-1 text-danger">
      {row.problems.map((problem) => (
        <li key={problem} className="flex items-start gap-1.5">
          <CircleAlert aria-hidden size={16} strokeWidth={1.9} className="mt-px flex-none" />
          {problem}
        </li>
      ))}
    </ul>
  );
}

type PreviewTableProps = Readonly<{ rows: readonly PreviewRow[]; step: PreviewStepProps['step'] }>;

function PreviewTable({ rows, step }: PreviewTableProps) {
  const fields = IMPORT_FIELDS.filter((field) => step.draft.mapping[field] !== undefined);
  return (
    <div className="max-w-full overflow-x-auto rounded-lg inset-ring inset-ring-line">
      <table
        aria-label={COPY.caption}
        className="w-full min-w-max text-[13px] leading-[1.45] tabular-nums"
      >
        <thead className="bg-surface-2 text-ink-2">
          <tr>
            <th scope="col" className={CELL}>
              {COPY.line}
            </th>
            <th scope="col" className={CELL}>
              {COPY.check}
            </th>
            {fields.map((field) => (
              <th key={field} scope="col" className={CELL}>
                {IMPORT_FIELD_LABELS[field].labelUk}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-ink">
          {rows.map((row) => (
            <tr key={row.line} className="border-t border-line-soft">
              <th scope="row" className={cn(CELL, 'font-semibold text-ink-2')}>
                {row.line}
              </th>
              <td className={CELL}>
                <RowCheck row={row} />
              </td>
              {fields.map((field) => (
                <td key={field} className={cn(CELL, row.issues.includes(field) && 'text-danger')}>
                  {row.cells[field]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PreviewStep({ step, model }: PreviewStepProps) {
  const rows = previewOf({ ...step.draft, now: step.now });
  const total = step.draft.sheet.rows.length;
  const valid = validCountOf({ ...step.draft, now: step.now });
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <StepHeading
        title={COPY.title}
        detail={COPY.summary({ shown: rows.length, total, invalid: total - valid })}
      />
      <PreviewTable rows={rows} step={step} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          className={TOUCH_HEIGHT}
          disabled={model.importing}
          onClick={() => {
            model.actions.map(step.draft);
          }}
        >
          {COPY.back}
        </Button>
        <Button
          className={TOUCH_HEIGHT}
          loading={model.importing}
          disabled={valid === 0}
          onClick={() => {
            model.actions.submit(step.draft);
          }}
        >
          {COPY.submit({ valid, total })}
        </Button>
      </div>
    </div>
  );
}
