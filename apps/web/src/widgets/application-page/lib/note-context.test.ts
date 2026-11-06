import type { TimelineItem } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { ACME_APPLICATION } from '@/test/application-fixtures';
import { noteOf } from '@/test/note-fixtures';
import { DESIGN_NOTE, DESIGN_TIMELINE } from '@/test/timeline-fixtures';

import { noteContextOf } from './note-context';

type ContextCase = {
  name: string;
  createdAt: string;
  items?: readonly TimelineItem[];
  context: string;
};

const ITEMS = DESIGN_TIMELINE.items;

const CASES: readonly ContextCase[] = [
  {
    name: 'a note after the move to the tech interview names it',
    createdAt: '2026-09-03T12:40:00Z',
    context: "03.09, після техінтерв'ю",
  },
  {
    name: 'a note between two moves names the earlier one',
    createdAt: '2026-08-25T10:00:00Z',
    context: '25.08, після скринінгу',
  },
  {
    name: 'a note written at the moment of a move counts that move',
    createdAt: '2026-08-21T09:00:00Z',
    context: '21.08, після скринінгу',
  },
  {
    name: 'a note before the first move shows the date alone',
    createdAt: '2026-08-12T11:00:00Z',
    context: '12.08',
  },
  {
    name: 'a note with no timeline loaded yet shows the date alone',
    createdAt: '2026-09-03T12:40:00Z',
    items: [],
    context: '03.09',
  },
  {
    name: 'the order the timeline arrives in does not change the stage',
    createdAt: '2026-08-25T10:00:00Z',
    items: [...ITEMS].reverse(),
    context: '25.08, після скринінгу',
  },
  {
    name: 'the date is the calendar day in the user timezone',
    createdAt: '2026-09-03T22:30:00Z',
    context: "04.09, після техінтерв'ю",
  },
];

describe('noteContextOf', () => {
  it.each(CASES)('$name', ({ createdAt, items = ITEMS, context }) => {
    const note = noteOf({ applicationId: ACME_APPLICATION.id, body: DESIGN_NOTE, createdAt });

    expect(noteContextOf({ note, items, timeZone: 'Europe/Kyiv' })).toBe(context);
  });
});
