'use client';

import type { Application } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { applicationQueryOptions } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { Sheet } from '@/shared/ui/sheet';

import { type ApplicationOrigin, ApplicationPage } from './application-page';

export type ApplicationSheetProps = Readonly<{ id: Application['id']; origin?: ApplicationOrigin }>;

const TAB_TITLE = `${uk.applicationPage.title} · ${uk.app.brand}`;

function useTabTitle() {
  useEffect(() => {
    const before = document.title;
    document.title = TAB_TITLE;
    return () => {
      document.title = before;
    };
  }, []);
}

export function ApplicationSheet({ id, origin = 'board' }: ApplicationSheetProps) {
  const router = useRouter();
  const { data } = useQuery({ ...applicationQueryOptions(id), enabled: false });
  useTabTitle();
  return (
    <Sheet
      title={data?.position ?? uk.applicationPage.title}
      onClose={() => {
        router.back();
      }}
    >
      <ApplicationPage id={id} view={{ mode: 'sheet', origin }} />
    </Sheet>
  );
}
