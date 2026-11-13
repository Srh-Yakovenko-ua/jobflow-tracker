'use client';

import {
  type FunnelStage,
  type SankeyNode,
  type SankeyResponse,
  STAGE_LABELS,
} from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { ChartFrame } from '@/shared/ui/chart-frame';
import { Fade } from '@/shared/ui/fade';
import { Switch } from '@/shared/ui/switch';

import { boardHrefOf, ghostTotalOf } from '../lib/sankey-nodes';
import type { SankeyFrame } from '../model/dashboard-view';
import { SankeyChart } from './sankey-chart';
import { SankeyTable } from './sankey-table';

const COPY = uk.analytics.blocks.sankey;

const LEGEND = [
  { outcome: 'rejected', swatch: 'bg-rejected' },
  { outcome: 'ghosted', swatch: 'bg-ghosted' },
  { outcome: 'withdrawn', swatch: 'bg-withdrawn' },
  { outcome: 'offer', swatch: 'bg-offer' },
] as const;

export type SankeyControls = Readonly<{
  searchId: string | undefined;
  byReason: boolean;
  toggle: () => void;
}>;

export type SankeyBlockProps = Readonly<{ frame: SankeyFrame; controls: SankeyControls }>;

type SankeyActionsProps = Readonly<{ controls: SankeyControls }>;

function SankeyActions({ controls }: SankeyActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4.5 gap-y-2">
      <ul className="flex flex-wrap gap-3.5 text-[12.5px] text-ink-2">
        {LEGEND.map(({ outcome, swatch }) => (
          <li key={outcome} className="flex items-center gap-1.75">
            <span aria-hidden className={cn('h-2.25 w-3 rounded-[3px]', swatch)} />
            {STAGE_LABELS[outcome].labelUk}
          </li>
        ))}
      </ul>
      <Switch
        label={<span className="text-[12.5px] text-ink-2">{COPY.split}</span>}
        checked={controls.byReason}
        onCheckedChange={controls.toggle}
      />
    </div>
  );
}

type SankeyPlotProps = Readonly<{
  graph: SankeyResponse;
  stages: readonly FunnelStage[] | undefined;
}>;

function SankeyPlot({ graph, stages }: SankeyPlotProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? graph.detailed : graph.merged;
  const folded = !expanded && graph.merged.nodes.some(({ kind }) => kind === 'other');
  const expand = () => {
    setExpanded(true);
  };
  const onNode = (node: SankeyNode) => {
    const href = boardHrefOf(node);
    if (href === null) setExpanded((open) => !open);
    else router.push(href);
  };
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SankeyChart graph={shown} stages={stages} actions={{ onNode }} />
      <AnimatePresence initial={false}>
        {folded && (
          <Fade key="expand" className="self-start">
            <Button variant="ghost" size="sm" onClick={expand}>
              {COPY.expand}
            </Button>
          </Fade>
        )}
      </AnimatePresence>
      <SankeyTable graph={shown} />
    </div>
  );
}

type GhostNoteProps = Readonly<{ graph: SankeyResponse | undefined }>;

function GhostNote({ graph }: GhostNoteProps) {
  const silent = graph === undefined ? 0 : ghostTotalOf(graph.merged);
  return (
    <AnimatePresence initial={false}>
      {silent > 0 && (
        <Fade
          key="ghost"
          className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4.5"
        >
          <p className="text-[14px] leading-[1.65] text-pretty text-ink-2 tabular-nums">
            <span className="font-semibold text-ink">{COPY.ghost.lead}</span>{' '}
            {COPY.ghost.body(silent)}
          </p>
        </Fade>
      )}
    </AnimatePresence>
  );
}

export function SankeyBlock({ frame, controls }: SankeyBlockProps) {
  const { graph, state } = frame;
  const loaded = state.status === 'ready' ? graph : undefined;
  return (
    <>
      <ChartFrame
        header={frame.header}
        state={state}
        view={{ plot: 'hero', actions: <SankeyActions controls={controls} /> }}
      >
        {loaded && (
          <SankeyPlot
            key={`${controls.searchId ?? ''}:${String(controls.byReason)}`}
            graph={loaded}
            stages={frame.stages}
          />
        )}
      </ChartFrame>
      <GhostNote graph={loaded} />
    </>
  );
}
