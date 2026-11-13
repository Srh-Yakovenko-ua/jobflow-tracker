import { buildDesignSankey, buildFoldedSankey } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';
import { DESIGN_NODE_LABELS } from '@/test/analytics-fixtures';

import { boardHrefOf, ghostTotalOf, sankeyLayoutOf } from './sankey-nodes';

const GHOST = uk.analytics.blocks.sankey.ghost;

describe('sankeyLayoutOf', () => {
  it('names every node of the 54 application search with its count, the larger of in and out', () => {
    expect(sankeyLayoutOf(buildDesignSankey().merged).labels).toEqual(DESIGN_NODE_LABELS);
  });

  it('names reasons, the folded small reasons and the open applications in words, never by code', () => {
    const { merged, detailed } = buildFoldedSankey();

    expect(sankeyLayoutOf(merged).labels).toEqual({
      applied: 'відгук 380',
      skills_gap: 'не вистачає скілів 3',
      other: 'інші 2',
      in_progress: 'у процесі 375',
    });
    expect(sankeyLayoutOf(detailed).labels.english_level).toBe('рівень англійської 2');
  });

  it('puts the five stages in columns 0 to 4 as drawn and keeps the API node order as priority', () => {
    const layout = sankeyLayoutOf(buildDesignSankey().merged);

    expect(layout.column).toEqual({
      applied: 0,
      screening: 1,
      tech_interview: 2,
      final: 3,
      offer: 4,
    });
    expect(layout.priority).toEqual({
      applied: 0,
      screening: 1,
      tech_interview: 2,
      final: 3,
      offer: 4,
      rejected: 5,
      ghosted: 6,
      withdrawn: 7,
    });
  });
});

describe('ghostTotalOf', () => {
  it('adds up the ghost links: 17 companies stayed silent in the design search, none in the folded one', () => {
    expect(ghostTotalOf(buildDesignSankey().merged)).toBe(17);
    expect(ghostTotalOf(buildFoldedSankey().merged)).toBe(0);
  });

  it('agrees the ghost note with one company and with many', () => {
    expect(GHOST.body(1)).toBe('1 компанія не відповіла. Вона не входить у розрахунок конверсій.');
    expect(GHOST.body(17)).toBe(
      '17 компаній не відповіли. Вони не входять у розрахунок конверсій.',
    );
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
