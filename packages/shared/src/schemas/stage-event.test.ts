import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import { moveApplicationInputSchema, STAGE_MOVE_LIMITS } from './stage-event.js';

const MOVE = { fromStage: 'applied', toStage: 'screening' } as const;

describe('moveApplicationInputSchema', () => {
  it('keeps a move with only fromStage and toStage', () => {
    expect(moveApplicationInputSchema.parse(MOVE)).toEqual(MOVE);
  });

  it.for(['rejected', 'ghosted', 'withdrawn'] as const)(
    'accepts a reason code on a move to %s',
    (toStage) => {
      const move = { fromStage: 'final', toStage, reasonCode: 'skills_gap' } as const;
      expect(moveApplicationInputSchema.parse(move)).toEqual(move);
    },
  );

  it('trims the comment and keeps a backdated occurredAt in UTC', () => {
    const move = { ...MOVE, comment: '  Дзвінок з HR  ', occurredAt: '2026-10-28T09:30:00.000Z' };
    expect(moveApplicationInputSchema.parse(move)).toEqual({
      ...MOVE,
      comment: 'Дзвінок з HR',
      occurredAt: '2026-10-28T09:30:00.000Z',
    });
  });

  it('accepts a comment of exactly 1000 characters', () => {
    const comment = 'c'.repeat(1000);
    expect(moveApplicationInputSchema.parse({ ...MOVE, comment }).comment).toBe(comment);
  });

  it('keeps the undo window at 10 seconds', () => {
    expect(STAGE_MOVE_LIMITS).toEqual({ commentMaxLength: 1000, undoWindowMs: 10_000 });
  });

  it.for([
    { label: 'a missing fromStage', body: { toStage: 'screening' }, path: 'fromStage' },
    { label: 'an unknown toStage', body: { ...MOVE, toStage: 'hired' }, path: 'toStage' },
    {
      label: 'a reason code on a move to screening',
      body: { ...MOVE, reasonCode: 'skills_gap' },
      path: 'reasonCode',
    },
    { label: 'an unknown reason code', body: { ...MOVE, reasonCode: 'bored' }, path: 'reasonCode' },
    { label: 'a blank comment', body: { ...MOVE, comment: '   ' }, path: 'comment' },
    {
      label: 'a 1001-character comment',
      body: { ...MOVE, comment: 'c'.repeat(1001) },
      path: 'comment',
    },
    {
      label: 'a comment with a NUL character',
      body: { ...MOVE, comment: 'a\u0000b' },
      path: 'comment',
    },
    {
      label: 'an occurredAt with an offset',
      body: { ...MOVE, occurredAt: '2026-10-28T12:30:00+03:00' },
      path: 'occurredAt',
    },
    {
      label: 'an occurredAt that is not ISO',
      body: { ...MOVE, occurredAt: 'yesterday' },
      path: 'occurredAt',
    },
  ])('refuses $label at $path', ({ body, path }) => {
    expect(issuePathsOf(moveApplicationInputSchema.safeParse(body))).toEqual([path]);
  });
});
