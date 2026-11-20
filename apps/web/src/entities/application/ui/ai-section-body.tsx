import type { ReactNode } from 'react';

import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { TextSkeleton } from '@/shared/ui/skeleton';

import type { AiSection, AiSectionReady } from '../model/ai-poll';

export type AiSectionBodyProps<Data> = Readonly<{
  section: AiSection<Data>;
  children: (ready: AiSectionReady<Data>) => ReactNode;
}>;

export function AiSectionBody<Data>({ section, children }: AiSectionBodyProps<Data>) {
  const { load, response, job } = section;
  if (load.failed) return <LoadFailedPanel onRetry={load.onRetry} retrying={load.retrying} />;
  if (load.pending || response === undefined) return <TextSkeleton />;
  return children({ response, job });
}
