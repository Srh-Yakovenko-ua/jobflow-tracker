import { resumeMimeSchema, type ResumeVersion } from '@jobflow/shared';

import { fileExtensionOf } from '@/entities/resume';
import { uk } from '@/shared/i18n';

export function fileFormatOf({ mime, filename }: Pick<ResumeVersion, 'mime' | 'filename'>): string {
  const known = resumeMimeSchema.safeParse(mime);
  if (known.success) return uk.resumes.formats[known.data];
  return fileExtensionOf(filename).toUpperCase();
}
