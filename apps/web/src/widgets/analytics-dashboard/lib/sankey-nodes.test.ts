import type { FunnelStage, RateResult } from '@jobflow/shared';
import { buildDesignFunnel, buildDesignSankey, buildFoldedSankey } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';
import { DESIGN_ENDINGS, DESIGN_FUNNEL_ROWS } from '@/test/analytics-fixtures';

import {
  boardHrefOf,
  endingsOf,
  firstRevealedNode,
  type FunnelRow,
  funnelRowsOf,
  ghostTotalOf,
} from './sankey-nodes';

const GHOST = uk.analytics.blocks.sankey.ghost;

const { stages } = buildDesignFunnel();

const DESIGN = buildDesignSankey().merged;

function textOf(rows: readonly FunnelRow[]) {
  return rows.map(({ label, rate, exits }) => ({
    stage: label,
    conversion: rate,
    exits: exits.map((exit) => exit.label),
  }));
}

function markedIn(rows: readonly FunnelRow[]) {
  return rows.filter((row) => row.biggestDrop).map((row) => row.node.id);
}

function withConversions(rates: readonly (RateResult | null)[]): FunnelStage[] {
  return stages.map((stage, index) => ({ ...stage, conversion: rates[index] ?? null }));
}

const SHORT = stages.find((stage) => stage.stage === 'final')?.conversion ?? null;

const HALF: RateResult = { status: 'ok', value: 0.5, low: 0.2, high: 0.8, successes: 4, trials: 8 };

describe('funnelRowsOf', () => {
  it('reads every stage of the 54 application search with its count, its conversion and where the rest went', () => {
    const rows = funnelRowsOf({ graph: DESIGN, stages });

    expect(textOf(rows)).toEqual(DESIGN_FUNNEL_ROWS);
    expect(rows.map((row) => row.reached)).toEqual([54, 17, 9, 4, 1]);
    expect(rows.map((row) => row.passed)).toEqual([17, 9, 4, 1, 0]);
  });

  it('marks відгук → скринінг, 43% against 60% and 50%, as the biggest drop and no other stage', () => {
    expect(markedIn(funnelRowsOf({ graph: DESIGN, stages }))).toEqual(['applied']);
  });

  it('marks nothing when no conversion has enough data, and the earlier stage wins a tie', () => {
    const short = withConversions([SHORT, SHORT, SHORT, SHORT, null]);
    const tied = withConversions([HALF, HALF, HALF, SHORT, null]);

    expect(markedIn(funnelRowsOf({ graph: DESIGN, stages: short }))).toEqual([]);
    expect(markedIn(funnelRowsOf({ graph: DESIGN, stages: tied }))).toEqual(['applied']);
  });

  it('shows no conversion and marks nothing before the funnel loads', () => {
    const rows = funnelRowsOf({ graph: DESIGN, stages: undefined });

    expect(rows.map((row) => row.rate)).toEqual([null, null, null, null, null]);
    expect(rows.map((row) => row.conversion)).toEqual([null, null, null, null, null]);
    expect(markedIn(rows)).toEqual([]);
  });

  it('puts open applications first, then the reasons and "інші" in graph order, each filled as a rejection', () => {
    const { merged, detailed } = buildFoldedSankey();
    const [applied] = funnelRowsOf({ graph: merged, stages });

    expect(applied?.exits.map((exit) => exit.label)).toEqual([
      'у процесі 375',
      'не вистачає скілів 3',
      'інші 2',
    ]);
    expect(applied?.exits.map((exit) => exit.fill)).toEqual([
      'bg-ink-3',
      'bg-rejected',
      'bg-rejected',
    ]);
    expect(textOf(funnelRowsOf({ graph: detailed, stages }))[0]?.exits).toContain(
      'рівень англійської 2',
    );
  });
});

describe('endingsOf', () => {
  it('counts where the 54 applications ended, offer included, every stage passed through left out', () => {
    expect(endingsOf(DESIGN).map((ending) => `${ending.label} ${String(ending.total)}`)).toEqual(
      DESIGN_ENDINGS,
    );
  });

  it('sums the reasons and "інші" into відмова and counts the open applications', () => {
    expect(endingsOf(buildFoldedSankey().merged)).toEqual([
      { id: 'in_progress', label: 'у процесі', total: 375, fill: 'bg-ink-3' },
      { id: 'rejected', label: 'відмова', total: 5, fill: 'bg-rejected' },
    ]);
  });
});

describe('ghostTotalOf', () => {
  it('adds up the ghost links: 17 companies stayed silent in the design search, none in the folded one', () => {
    expect(ghostTotalOf(DESIGN)).toBe(17);
    expect(ghostTotalOf(buildFoldedSankey().merged)).toBe(0);
  });

  it('agrees the ghost note with one company and with many', () => {
    expect(GHOST.body(1)).toBe('1 компанія не відповіла. Вона не входить у розрахунок конверсій.');
    expect(GHOST.body(17)).toBe(
      '17 компаній не відповіли. Вони не входять у розрахунок конверсій.',
    );
  });
});

describe('firstRevealedNode', () => {
  it('finds english_level as the first reason folded into "інші" and none when nothing is folded', () => {
    expect(firstRevealedNode(buildFoldedSankey())?.id).toBe('english_level');
    expect(firstRevealedNode(buildDesignSankey())).toBeUndefined();
  });
});

describe('boardHrefOf', () => {
  it.each([
    { node: { id: 'tech_interview', kind: 'stage' }, href: '/board?stage=tech_interview' },
    { node: { id: 'ghosted', kind: 'outcome' }, href: '/board?stage=ghosted' },
    { node: { id: 'skills_gap', kind: 'reason' }, href: '/board?stage=rejected' },
    {
      node: { id: 'in_progress', kind: 'in_progress' },
      href: '/board?stage=applied%2Cscreening%2Ctech_interview%2Cfinal',
    },
    { node: { id: 'other', kind: 'other' }, href: null },
  ] as const)('sends $node.id to $href', ({ node, href }) => {
    expect(boardHrefOf(node)).toBe(href);
  });
});
