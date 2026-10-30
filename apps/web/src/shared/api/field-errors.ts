import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import type { ApiError } from './api-error';

export type ApplyFieldErrorsOptions<T extends FieldValues> = {
  error: ApiError;
  fields: readonly NoInfer<Path<T>>[];
  setError: UseFormSetError<T>;
  messages?: Readonly<Partial<Record<NoInfer<Path<T>>, string>>>;
};

export function applyFieldErrors<T extends FieldValues>({
  error,
  fields,
  setError,
  messages,
}: ApplyFieldErrorsOptions<T>): void {
  const unmatched: string[] = [];
  let matched = 0;
  for (const { path, message } of error.body.errors ?? []) {
    const field = fields.find((candidate) => candidate === path);
    if (field === undefined) {
      unmatched.push(message);
    } else {
      matched += 1;
      setError(field, { type: 'server', message: messages?.[field] ?? message });
    }
  }
  if (unmatched.length > 0 || matched === 0) {
    const message = unmatched[0] ?? error.body.detail ?? error.body.title;
    setError('root.server', { type: 'server', message });
  }
}
