'use client';

import type { Application } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { applicationQueryOptions } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { Sheet } from '@/shared/ui/sheet';

import { ApplicationPage } from './application-page';

export type ApplicationSheetProps = Readonly<{ id: Application['id'] }>;

export function ApplicationSheet({ id }: ApplicationSheetProps) {
  const router = useRouter();
  const { data } = useQuery({ ...applicationQueryOptions(id), enabled: false });
  return (
    <Sheet
      title={data?.position ?? uk.applicationPage.title}
      onClose={() => {
        router.back();
      }}
    >
      <ApplicationPage id={id} view={{ mode: 'sheet' }} />
    </Sheet>
  );
}
