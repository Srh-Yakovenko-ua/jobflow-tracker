import type { ReactNode } from 'react';

import type { SelectOption } from './field-surface';

export type OptionContentProps = Readonly<{ option: SelectOption; label: ReactNode }>;

export function OptionContent({ option, label }: OptionContentProps) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate">{label}</span>
        {option.detail && <span className="caption font-normal text-ink-3">{option.detail}</span>}
      </span>
      {option.meta && (
        <span className="caption flex-none font-normal text-ink-3 tabular-nums">{option.meta}</span>
      )}
    </>
  );
}
