'use client';

import type { FunnelStage, SankeyGraph, SankeyResponse } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';

import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { ChartFrame } from '@/shared/ui/chart-frame';
import { Fade } from '@/shared/ui/fade';
import { Switch } from '@/shared/ui/switch';

import { endingsOf, firstRevealedNode } from '../lib/sankey-nodes';
import type { SankeyFrame } from '../model/dashboard-view';
import { FunnelChart } from './funnel-chart';
import { FunnelNotes } from './funnel-notes';
import { SankeyTable } from './sankey-table';
import { Swatch } from './swatch';

const COPY = uk.analytics.blocks.sankey;

export type SankeyControls = Readonly<{
  searchId: string | undefined;
  byReason: boolean;
  toggle: () => void;
}>;

export type SankeyBlockProps = Readonly<{ frame: SankeyFrame; controls: SankeyControls }>;

type SankeyActionsProps = Readonly<{ controls: SankeyControls }>;

function SankeyActions({ controls }: SankeyActionsProps) {
  return (
    <Switch
      label={<span className="text-[12.5px] text-ink-2">{COPY.split}</span>}
      checked={controls.byReason}
      onCheckedChange={controls.toggle}
    />
  );
}

type EndingsProps = Readonly<{ graph: SankeyGraph }>;

function Endings({ graph }: EndingsProps) {
  const titleId = useId();
  const endings = endingsOf(graph);
  if (endings.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 id={titleId} className="eyebrow text-ink-3">
        {COPY.endings}
      </h3>
      <ul
        aria-labelledby={titleId}
        className="flex flex-wrap gap-x-4.5 gap-y-1.5 text-[13px] text-ink-2 tabular-nums"
      >
        {endings.map(({ id, label, total, fill }) => (
          <li key={id} className="flex items-center gap-1.75">
            <Swatch fill={fill} />
            {label} <span className="font-semibold text-ink">{total}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type SankeyPlotProps = Readonly<{
  graph: SankeyResponse;
  stages: readonly FunnelStage[] | undefined;
}>;

function useRevealFocus(graph: SankeyResponse) {
  const [expanded, setExpanded] = useState(false);
  const plotRef = useRef<HTMLDivElement>(null);
  const revealingRef = useRef(false);
  useEffect(() => {
    const revealed = revealingRef.current ? firstRevealedNode(graph) : undefined;
    revealingRef.current = false;
    if (revealed === undefined) return;
    plotRef.current
      ?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(revealed.id)}"]`)
      ?.focus();
  }, [expanded, graph]);
  const expand = () => {
    revealingRef.current = true;
    setExpanded(true);
  };
  return { expanded, plotRef, expand };
}

function SankeyPlot({ graph, stages }: SankeyPlotProps) {
  const { expanded, plotRef, expand } = useRevealFocus(graph);
  const shown = expanded ? graph.detailed : graph.merged;
  const folded = !expanded && graph.merged.nodes.some(({ kind }) => kind === 'other');
  return (
    <div ref={plotRef} className="flex min-w-0 flex-col gap-3">
      <FunnelChart graph={shown} stages={stages} actions={{ onExpand: expand }} />
      <AnimatePresence initial={false}>
        {folded && (
          <Fade key="expand" className="self-start">
            <Button variant="ghost" size="sm" onClick={expand}>
              {COPY.expand}
            </Button>
          </Fade>
        )}
      </AnimatePresence>
      <Endings graph={shown} />
      <SankeyTable graph={shown} />
    </div>
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
      <AnimatePresence initial={false}>
        {loaded && <FunnelNotes key="funnel-notes" notes={frame.notes} graph={loaded} />}
      </AnimatePresence>
    </>
  );
}
