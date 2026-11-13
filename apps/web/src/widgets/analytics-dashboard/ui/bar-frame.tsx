'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { ChartFrame } from '@/shared/ui/chart-frame';

import type { BarActions } from '../lib/bar-look';
import type { DashboardFrame } from '../model/dashboard-view';

export type BarFrameProps<Data> = Readonly<{
  frame: DashboardFrame & Readonly<{ data: Data | undefined }>;
  plot: (data: Data, actions: BarActions) => ReactNode;
}>;

export function BarFrame<Data>({ frame, plot }: BarFrameProps<Data>) {
  const router = useRouter();
  const ready = frame.state.status === 'ready' ? frame.data : undefined;
  const actions: BarActions = {
    onBar: (href) => {
      router.push(href);
    },
  };
  return (
    <ChartFrame header={frame.header} state={frame.state} view={{ plot: 'open' }}>
      {ready !== undefined && plot(ready, actions)}
    </ChartFrame>
  );
}
