'use client';

import {
  EXPORT_FORMATS,
  type ExportFormat,
  type ExportLink,
  type ReadyExportLink,
} from '@jobflow/shared';
import { Download } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useState } from 'react';

import { isNotFound } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { LoadFailedAlert } from '@/shared/ui/banner';
import { Button, buttonLinkClasses } from '@/shared/ui/button';
import { Fade } from '@/shared/ui/fade';
import type { ChoiceOption } from '@/shared/ui/radio-group';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { Spinner } from '@/shared/ui/spinner';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { useExportLinkQuery } from '../model/use-export-link-query';
import { useRequestExportMutation } from '../model/use-request-export-mutation';

const COPY = uk.settings.account.export;

const FORMATS: readonly ChoiceOption<ExportFormat>[] = EXPORT_FORMATS.map((value) => ({
  value,
  label: COPY.formats[value],
}));

export type ExportDataControlProps = Readonly<{ initialExportId: string | null }>;

function ExportDownload({ link }: Readonly<{ link: ReadyExportLink }>) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={link.url}
        className={cn(buttonLinkClasses({ variant: 'primary', size: 'md' }), TOUCH_HEIGHT)}
      >
        <Download aria-hidden size={16} strokeWidth={1.9} />
        {COPY.download}
      </a>
      <span className="text-[12.5px] leading-[1.45] text-ink-3">{COPY.linkTtl}</span>
    </div>
  );
}

type LinkState = Readonly<{ error: Error | null; data: ExportLink | undefined }>;

const STATUS_LINE = 'flex items-center gap-2 text-[13px] leading-[1.45] text-ink-2';

function exportStateOf({ error, data }: LinkState): 'failed' | 'gone' | 'ready' | 'building' {
  if (error !== null) return isNotFound(error) ? 'gone' : 'failed';
  return data?.status === 'ready' ? 'ready' : 'building';
}

function ExportStatus({ exportId }: Readonly<{ exportId: string }>) {
  const link = useExportLinkQuery(exportId);
  const state = exportStateOf(link);
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <Fade key={state}>
        {state === 'failed' && (
          <LoadFailedAlert
            onRetry={() => {
              void link.refetch();
            }}
          />
        )}
        {state === 'building' && (
          <p role="status" className={STATUS_LINE}>
            <Spinner className="text-accent" />
            {COPY.building}
          </p>
        )}
        {state === 'gone' && (
          <p role="status" className={STATUS_LINE}>
            {COPY.gone}
          </p>
        )}
        {state === 'ready' && link.data?.status === 'ready' && <ExportDownload link={link.data} />}
      </Fade>
    </AnimatePresence>
  );
}

export function ExportDataControl({ initialExportId }: ExportDataControlProps) {
  const [format, setFormat] = useState<ExportFormat>('json');
  const [exportId, setExportId] = useState(initialExportId);
  const exporting = useRequestExportMutation();
  return (
    <div className="flex min-w-0 flex-col items-start gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          aria-label={COPY.formatLabel}
          options={FORMATS}
          value={format}
          onValueChange={setFormat}
        />
        <Button
          variant="secondary"
          className={TOUCH_HEIGHT}
          loading={exporting.isPending}
          onClick={() => {
            exporting.request(format, (accepted) => {
              setExportId(accepted.exportId);
            });
          }}
        >
          {COPY.action}
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {exportId !== null && (
          <Fade key={exportId}>
            <ExportStatus exportId={exportId} />
          </Fade>
        )}
      </AnimatePresence>
    </div>
  );
}
