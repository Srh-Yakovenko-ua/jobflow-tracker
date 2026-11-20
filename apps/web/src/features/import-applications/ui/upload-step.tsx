'use client';

import { CSV_FILE_TYPE, IMPORT_LIMITS, IMPORT_TEMPLATE, toCsv } from '@jobflow/shared';
import { Download } from 'lucide-react';
import { AnimatePresence } from 'motion/react';

import { uk } from '@/shared/i18n';
import { saveTextFile } from '@/shared/lib/save-text-file';
import { formatMegabytes } from '@/shared/lib/state-format';
import { Button } from '@/shared/ui/button';
import { DropZone } from '@/shared/ui/drop-zone';
import { Fade } from '@/shared/ui/fade';
import { InlineAlert } from '@/shared/ui/inline-alert';
import { Spinner } from '@/shared/ui/spinner';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import type { ImportFileRefusal } from '../lib/import-file';
import type { ImportStep } from '../model/use-import-wizard';

const COPY = uk.dataImport.upload;

const ACCEPT = '.csv,text/csv';

const LIMIT = formatMegabytes(IMPORT_LIMITS.fileMaxBytes);

const REFUSALS: Record<ImportFileRefusal, string> = {
  type: COPY.refusals.type,
  size: COPY.refusals.size(LIMIT),
  empty: COPY.refusals.empty,
  rows: COPY.refusals.rows(IMPORT_LIMITS.rowsMax),
  unreadable: COPY.refusals.unreadable,
};

const TEMPLATE = {
  text: toCsv(IMPORT_TEMPLATE),
  fileName: 'jobflow-import-template.csv',
  type: CSV_FILE_TYPE,
} as const;

export type UploadStepProps = Readonly<{
  step: Extract<ImportStep, { name: 'upload' }>;
  onFile: (file: File) => void;
}>;

export function UploadStep({ step, onFile }: UploadStepProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DropZone
        picker={{ label: COPY.pick, accept: ACCEPT, disabled: step.reading }}
        onFile={onFile}
        className="flex flex-col items-start gap-3 rounded-lg p-5"
      >
        <span className="flex flex-col gap-1.5">
          <span className="text-[14.5px] font-semibold text-ink">{COPY.title}</span>
          <span className="text-[13px] leading-[1.5] text-ink-3">
            {COPY.hint(IMPORT_LIMITS.rowsMax, LIMIT)}
          </span>
        </span>
      </DropZone>
      <AnimatePresence initial={false}>
        {step.reading && (
          <Fade key="reading">
            <p role="status" className="flex items-center gap-2 text-[13px] text-ink-2">
              <Spinner className="text-accent" />
              {COPY.reading}
            </p>
          </Fade>
        )}
      </AnimatePresence>
      <InlineAlert message={step.refusal === null ? null : REFUSALS[step.refusal]} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          variant="ghost"
          className={TOUCH_HEIGHT}
          icon={<Download aria-hidden size={16} strokeWidth={1.9} />}
          onClick={() => {
            saveTextFile(TEMPLATE);
          }}
        >
          {COPY.template}
        </Button>
        <span className="text-[12.5px] leading-[1.45] text-ink-3">{COPY.templateHint}</span>
      </div>
    </div>
  );
}
