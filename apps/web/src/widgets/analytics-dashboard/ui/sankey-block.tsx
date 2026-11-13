'use client';

import type { FunnelStage, SankeyGraph, SankeyResponse } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';
import { useId, useState } from 'react';

import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { ChartFrame } from '@/shared/ui/chart-frame';
import { Fade } from '@/shared/ui/fade';
import { Switch } from '@/shared/ui/switch';

import { endingsOf, ghostTotalOf } from '../lib/sankey-nodes';
import type { SankeyFrame } from '../model/dashboard-view';
import { FunnelChart } from './funnel-chart';
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

function SankeyPlot({ graph, stages }: SankeyPlotProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? graph.detailed : graph.merged;
  const folded = !expanded && graph.merged.nodes.some(({ kind }) => kind === 'other');
  const expand = () => {
    setExpanded(true);
  };
  return (
    <div className="flex min-w-0 flex-col gap-3">
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
