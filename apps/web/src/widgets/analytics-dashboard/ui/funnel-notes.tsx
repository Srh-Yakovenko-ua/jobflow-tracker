'use client';

import type { SankeyResponse } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';

import { uk } from '@/shared/i18n';
import { Fade } from '@/shared/ui/fade';

import type { FunnelNote } from '../lib/block-titles';
import { ghostTotalOf } from '../lib/sankey-nodes';

const COPY = uk.analytics.blocks.sankey;

const NOTE_MOTION = { layout: 'position' } as const;

type NoteText = Readonly<{ key: string; lead: string; body: string }>;

export type FunnelNotesProps = Readonly<{
  notes: readonly FunnelNote[];
  graph: SankeyResponse | undefined;
}>;

function localGhostOf({ notes, graph }: FunnelNotesProps): NoteText[] {
  const silent = graph === undefined ? 0 : ghostTotalOf(graph.merged);
  if (silent === 0 || notes.some(({ block }) => block === 'ghosted')) return [];
  return [{ key: 'local-ghost', lead: COPY.ghost.lead, body: COPY.ghost.body(silent) }];
}

function textsOf(props: FunnelNotesProps): NoteText[] {
  const served = props.notes.map(({ block, title, body }) => ({
    key: `${block}:${title}`,
    lead: COPY.notes.lead(title),
    body,
  }));
  return [...served, ...localGhostOf(props)];
}

export function FunnelNotes(props: FunnelNotesProps) {
  const texts = textsOf(props);
  return (
    <AnimatePresence initial={false}>
      {texts.length > 0 && (
        <Fade key="notes">
          <div
            role="group"
            aria-label={COPY.notes.label}
            className="relative grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4.5"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {texts.map(({ key, lead, body }) => (
                <Fade key={key} motion={NOTE_MOTION}>
                  <p className="text-[14px] leading-[1.65] text-pretty text-ink-2 tabular-nums">
                    <span className="font-semibold text-ink">{lead}</span> {body}
                  </p>
                </Fade>
              ))}
            </AnimatePresence>
          </div>
        </Fade>
      )}
    </AnimatePresence>
  );
}
