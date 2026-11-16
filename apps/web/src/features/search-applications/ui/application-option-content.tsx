'use client';

import type { ApplicationCard } from '@jobflow/shared';
import type { ReactNode } from 'react';

import { OptionContent } from '@/shared/ui/option-content';

export type ApplicationOptionContentProps = Readonly<{
  application: Pick<ApplicationCard, 'id' | 'company' | 'position'>;
  footnote?: ReactNode;
}>;

export function ApplicationOptionContent({ application, footnote }: ApplicationOptionContentProps) {
  return (
    <OptionContent
      option={{ value: application.id, label: application.position, detail: application.company }}
      label={application.position}
      footnote={footnote}
    />
  );
}
