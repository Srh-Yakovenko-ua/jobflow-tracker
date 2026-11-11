'use client';

import type { SubmitEvent } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { VersionTitleField, type VersionTitleForm } from '@/entities/resume';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatFileSize } from '@/shared/lib/state-format';
import { Banner } from '@/shared/ui/banner';
import { Button } from '@/shared/ui/button';
import { FormServerError } from '@/shared/ui/form-server-error';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import type { UploadResume } from '../model/use-upload-resume';

const COPY = uk.resumes.upload;

const PERCENT = 100;

export type UploadFormState = Pick<UploadResume, 'pending' | 'percent'> & { retryable: boolean };

export type UploadFormProps = Readonly<{
  file: File;
  form: Readonly<{
    methods: UseFormReturn<VersionTitleForm>;
    onSubmit: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
  }>;
  state: UploadFormState;
}>;

function UploadProgress({ percent }: Readonly<{ percent: number }>) {
  return (
    <div className="flex items-center gap-3">
      <span
        role="progressbar"
        aria-label={COPY.progressLabel}
        aria-valuemin={0}
        aria-valuemax={PERCENT}
        aria-valuenow={percent}
        className="block h-1.5 flex-1 overflow-hidden rounded-[3px] bg-line-soft"
      >
        <span
          className="block h-full origin-left bg-accent transition-transform duration-(--duration-base) ease-standard"
          style={{ transform: `scaleX(${String(percent / PERCENT)})` }}
        />
      </span>
      <span aria-hidden className="w-9 flex-none text-right text-[12px] text-ink-3 tabular-nums">
        {COPY.percent(percent)}
      </span>
    </div>
  );
}

export function UploadForm({ file, form, state }: UploadFormProps) {
  return (
    <form
      noValidate
      onSubmit={(event) => {
        void form.onSubmit(event);
      }}
      className="flex min-w-0 flex-col gap-3.5 rounded-[12px] bg-surface p-4 shadow-e1"
    >
      <p className="flex min-w-0 items-baseline gap-2 text-[13px]">
        <span className="min-w-0 truncate font-semibold text-ink">{file.name}</span>
        <span className="flex-none text-ink-3 tabular-nums">{formatFileSize(file.size)}</span>
      </p>
      <FormServerError control={form.methods.control} />
      {state.retryable && <Banner tone="error" content={uk.errors.saveFailed} />}
      <VersionTitleField methods={form.methods} />
      {state.percent !== null && <UploadProgress percent={state.percent} />}
      <Button type="submit" loading={state.pending} className={cn(TOUCH_HEIGHT, 'self-start')}>
        {COPY.submit}
      </Button>
    </form>
  );
}
