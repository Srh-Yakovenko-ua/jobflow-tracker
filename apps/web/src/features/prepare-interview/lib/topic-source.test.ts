import { describe, expect, it } from 'vitest';

import { topicSourceOf } from './topic-source';

describe('topicSourceOf', () => {
  it.each([
    ['algorithms', { kind: 'weakSpot', detail: 'Алгоритми' }],
    ['system_design', { kind: 'weakSpot', detail: 'System design' }],
    ['skills_gap', { kind: 'weakSpot', detail: 'не вистачає скілів' }],
    ['React + TypeScript', { kind: 'requirement', detail: 'React + TypeScript' }],
    ['live_coding', { kind: 'requirement', detail: 'live_coding' }],
  ])('a topic built on %s names where it came from', (basis, source) => {
    expect(topicSourceOf(basis)).toEqual(source);
  });
});
