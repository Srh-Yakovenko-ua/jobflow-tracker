import type { ReactNode } from 'react';

import { ParsingCard } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { APPLIED, LIVE_PANEL, LIVE_TITLE, LiveSection, type LiveView } from './live-section';

const COPY = uk.add.explainer.panel;

export const EXPLAINER_COPY: ReactNode = (
  <>
    <h3 className={LIVE_TITLE}>{COPY.title}</h3>
    <p className="max-w-[56ch] text-[15px] leading-[1.6] text-ink-2">{COPY.body(APPLIED)}</p>
  </>
);

export const IDLE_VIEW: LiveView = {
  id: 'idle',
  preview: (
    <div aria-hidden>
      <ParsingCard parse={{ aiStatus: 'processing', aiJobId: null }} />
    </div>
  ),
  panel: <div className={cn(LIVE_PANEL, 'gap-4.5')}>{EXPLAINER_COPY}</div>,
};

export function AddExplainer() {
  return <LiveSection view={IDLE_VIEW} />;
}
