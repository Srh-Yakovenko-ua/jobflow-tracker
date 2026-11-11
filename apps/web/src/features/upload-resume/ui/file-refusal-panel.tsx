'use client';

import { uk } from '@/shared/i18n';
import { type ErrorPanelContent, FileTooBigPanel, PickAnotherPanel } from '@/shared/ui/error-panel';

import type { FileRefusal } from '../lib/resume-file';

const COPY = uk.resumes.errors;

const REFUSAL_COPY: Record<Exclude<FileRefusal['kind'], 'tooBig'>, ErrorPanelContent> = {
  unsupported: COPY.unsupportedType,
  unreadable: COPY.unreadable,
};

export type FileRefusalPanelProps = Readonly<{ refusal: FileRefusal; onPick: () => void }>;

export function FileRefusalPanel({ refusal, onPick }: FileRefusalPanelProps) {
  if (refusal.kind === 'tooBig') return <FileTooBigPanel file={refusal.file} onPick={onPick} />;
  return <PickAnotherPanel content={REFUSAL_COPY[refusal.kind]} onPick={onPick} />;
}
