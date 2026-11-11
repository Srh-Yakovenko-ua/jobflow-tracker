import {
  RESUME_MIMES,
  RESUME_UPLOAD_LIMITS,
  RESUME_VERSION_LIMITS,
  type ResumeMime,
  type ResumeUploadInput,
  resumeUploadInputSchema,
} from '@jobflow/shared';

import { fileExtensionOf } from '@/entities/resume';
import type { OversizedFile } from '@/shared/ui/error-panel';

export type FileRefusal =
  { kind: 'tooBig'; file: OversizedFile } | { kind: 'unsupported' } | { kind: 'unreadable' };

export type ResumeFileCheck = { kind: 'ok'; input: ResumeUploadInput } | FileRefusal;

const EXTENSION_MIMES: Readonly<Record<string, ResumeMime>> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function mimeOf(file: File): string {
  const declared = RESUME_MIMES.find((mime) => mime === file.type);
  return declared ?? EXTENSION_MIMES[fileExtensionOf(file.name.trim())] ?? file.type;
}

function refusalOf(file: File, failedPaths: readonly PropertyKey[]): FileRefusal {
  if (failedPaths.includes('mime')) return { kind: 'unsupported' };
  const limitBytes = RESUME_UPLOAD_LIMITS.maxBytes;
  if (file.size > limitBytes) return { kind: 'tooBig', file: { sizeBytes: file.size, limitBytes } };
  return { kind: 'unreadable' };
}

export function checkResumeFile(file: File): ResumeFileCheck {
  const parsed = resumeUploadInputSchema.safeParse({
    filename: file.name,
    mime: mimeOf(file),
    sizeBytes: file.size,
  });
  if (parsed.success) return { kind: 'ok', input: parsed.data };
  return refusalOf(
    file,
    parsed.error.issues.flatMap((issue) => issue.path.slice(0, 1)),
  );
}

export function defaultTitleOf(filename: string): string {
  const name = filename.trim();
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return stem.slice(0, RESUME_VERSION_LIMITS.titleMaxLength).trim();
}
