'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { RESUME_MIMES, RESUME_UPLOAD_LIMITS, type ResumeUploadInput } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { type VersionTitleForm, versionTitleFormSchema } from '@/entities/resume';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatMegabytes } from '@/shared/lib/state-format';
import { DropZone, type FilePicker } from '@/shared/ui/drop-zone';
import { Fade } from '@/shared/ui/fade';
import { STATE_TEXT } from '@/shared/ui/state-text';

import { checkResumeFile, defaultTitleOf, type FileRefusal } from '../lib/resume-file';
import { isFileRefusal } from '../lib/upload-failure';
import { useUploadResume } from '../model/use-upload-resume';
import { FileRefusalPanel } from './file-refusal-panel';
import { UploadForm } from './upload-form';

const COPY = uk.resumes;

const ACCEPT = [...RESUME_MIMES, '.pdf', '.docx'].join(',');

const LIMIT = formatMegabytes(RESUME_UPLOAD_LIMITS.maxBytes);

export type ResumeUploadSize = 'full' | 'panel';

export type ResumeUploadProps = Readonly<{
  view: { size: ResumeUploadSize };
  picker: FilePicker;
}>;

type PickedFile = { file: File; input: ResumeUploadInput };

const ZONES: Record<ResumeUploadSize, string> = {
  full: 'flex flex-col items-center gap-3 rounded-[9px] p-4 text-center',
  panel: 'flex flex-col items-start gap-2.5 rounded-[6px] p-4.5',
};

function ZoneText({ size }: Readonly<{ size: ResumeUploadSize }>) {
  if (size === 'full') return <p className="text-[13px] text-ink-3">{COPY.empty.drop}</p>;
  return (
    <>
      <span className={cn(STATE_TEXT.eyebrow, 'text-ink-3')}>{COPY.upload.eyebrow}</span>
      <span className="flex flex-col gap-2">
        <span className="text-[14.5px] font-semibold text-ink">{COPY.upload.title}</span>
        <span className="text-[13px] leading-[1.5] text-ink-3">{COPY.upload.hint(LIMIT)}</span>
      </span>
    </>
  );
}

function useResumeChoice() {
  const methods = useForm<VersionTitleForm>({
    mode: 'onTouched',
    defaultValues: { title: '' },
    resolver: zodResolver(versionTitleFormSchema),
  });
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [refusal, setRefusal] = useState<FileRefusal | null>(null);
  const choose = (file: File) => {
    const checked = checkResumeFile(file);
    const accepted = checked.kind === 'ok' ? { file, input: checked.input } : null;
    setRefusal(checked.kind === 'ok' ? null : checked);
    setPicked(accepted);
    methods.reset({ title: accepted === null ? '' : defaultTitleOf(file.name) });
  };
  const clear = () => {
    setPicked(null);
    methods.reset({ title: '' });
  };
  return { methods, picked, refusal, choose, clear };
}

export function ResumeUpload({ view, picker }: ResumeUploadProps) {
  const choice = useResumeChoice();
  const upload = useUploadResume(choice.methods.setError);
  const { picked } = choice;
  const refusal = choice.refusal ?? (isFileRefusal(upload.failure) ? upload.failure : null);
  const onSubmit = choice.methods.handleSubmit(({ title }) => {
    if (picked !== null) upload.send({ ...picked, title }, choice.clear);
  });
  return (
    <div className={cn('flex min-w-0 flex-col gap-3', view.size === 'full' && 'w-full')}>
      <DropZone
        picker={{
          label: COPY.upload.pick,
          accept: ACCEPT,
          inputRef: picker.inputRef,
          disabled: upload.pending,
        }}
        onFile={(file) => {
          upload.reset();
          choice.choose(file);
        }}
        className={ZONES[view.size]}
      >
        <ZoneText size={view.size} />
      </DropZone>
      <AnimatePresence mode="popLayout" initial={false}>
        {refusal !== null && (
          <Fade key="refusal">
            <FileRefusalPanel refusal={refusal} onPick={picker.open} />
          </Fade>
        )}
        {refusal === null && picked !== null && (
          <Fade key="form">
            <UploadForm
              file={picked.file}
              form={{ methods: choice.methods, onSubmit }}
              state={upload}
            />
          </Fade>
        )}
      </AnimatePresence>
    </div>
  );
}
