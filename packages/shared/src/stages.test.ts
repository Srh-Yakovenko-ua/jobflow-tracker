import { describe, expect, it } from 'vitest';

import { canTransition, type Stage } from './stages.js';

const ALLOWED = { ok: true } as const;
const NOT_ALLOWED = { ok: false, reason: 'not_allowed' } as const;
const TERMINAL = { ok: false, reason: 'terminal_stage' } as const;

const EXPECTED: readonly (readonly [Stage, Stage, ReturnType<typeof canTransition>])[] = [
  ['applied', 'applied', NOT_ALLOWED],
  ['applied', 'screening', ALLOWED],
  ['applied', 'tech_interview', ALLOWED],
  ['applied', 'final', NOT_ALLOWED],
  ['applied', 'offer', NOT_ALLOWED],
  ['applied', 'rejected', ALLOWED],
  ['applied', 'ghosted', ALLOWED],
  ['applied', 'withdrawn', ALLOWED],

  ['screening', 'applied', NOT_ALLOWED],
  ['screening', 'screening', NOT_ALLOWED],
  ['screening', 'tech_interview', ALLOWED],
  ['screening', 'final', ALLOWED],
  ['screening', 'offer', ALLOWED],
  ['screening', 'rejected', ALLOWED],
  ['screening', 'ghosted', ALLOWED],
  ['screening', 'withdrawn', ALLOWED],

  ['tech_interview', 'applied', NOT_ALLOWED],
  ['tech_interview', 'screening', NOT_ALLOWED],
  ['tech_interview', 'tech_interview', ALLOWED],
  ['tech_interview', 'final', ALLOWED],
  ['tech_interview', 'offer', ALLOWED],
  ['tech_interview', 'rejected', ALLOWED],
  ['tech_interview', 'ghosted', ALLOWED],
  ['tech_interview', 'withdrawn', ALLOWED],

  ['final', 'applied', NOT_ALLOWED],
  ['final', 'screening', NOT_ALLOWED],
  ['final', 'tech_interview', NOT_ALLOWED],
  ['final', 'final', NOT_ALLOWED],
  ['final', 'offer', ALLOWED],
  ['final', 'rejected', ALLOWED],
  ['final', 'ghosted', ALLOWED],
  ['final', 'withdrawn', ALLOWED],

  ['offer', 'applied', NOT_ALLOWED],
  ['offer', 'screening', NOT_ALLOWED],
  ['offer', 'tech_interview', NOT_ALLOWED],
  ['offer', 'final', NOT_ALLOWED],
  ['offer', 'offer', NOT_ALLOWED],
  ['offer', 'rejected', NOT_ALLOWED],
  ['offer', 'ghosted', NOT_ALLOWED],
  ['offer', 'withdrawn', ALLOWED],

  ['rejected', 'applied', TERMINAL],
  ['rejected', 'screening', TERMINAL],
  ['rejected', 'tech_interview', TERMINAL],
  ['rejected', 'final', TERMINAL],
  ['rejected', 'offer', TERMINAL],
  ['rejected', 'rejected', TERMINAL],
  ['rejected', 'ghosted', TERMINAL],
  ['rejected', 'withdrawn', TERMINAL],

  ['ghosted', 'applied', ALLOWED],
  ['ghosted', 'screening', ALLOWED],
  ['ghosted', 'tech_interview', ALLOWED],
  ['ghosted', 'final', ALLOWED],
  ['ghosted', 'offer', NOT_ALLOWED],
  ['ghosted', 'rejected', NOT_ALLOWED],
  ['ghosted', 'ghosted', NOT_ALLOWED],
  ['ghosted', 'withdrawn', NOT_ALLOWED],

  ['withdrawn', 'applied', TERMINAL],
  ['withdrawn', 'screening', TERMINAL],
  ['withdrawn', 'tech_interview', TERMINAL],
  ['withdrawn', 'final', TERMINAL],
  ['withdrawn', 'offer', TERMINAL],
  ['withdrawn', 'rejected', TERMINAL],
  ['withdrawn', 'ghosted', TERMINAL],
  ['withdrawn', 'withdrawn', TERMINAL],
];

describe('canTransition', () => {
  it('has an expected result for each of the 64 stage pairs', () => {
    expect(new Set(EXPECTED.map(([from, to]) => `${from}->${to}`)).size).toBe(64);
  });

  it.each(EXPECTED)('answers %s -> %s with %o', (from, to, expected) => {
    expect(canTransition(from, to)).toEqual(expected);
  });

  it('refuses a move from offer back to applied', () => {
    expect(canTransition('offer', 'applied')).toEqual({ ok: false, reason: 'not_allowed' });
  });

  it('allows the next tech interview round', () => {
    expect(canTransition('tech_interview', 'tech_interview')).toEqual({ ok: true });
  });

  it('refuses any move out of rejected with terminal_stage', () => {
    expect(canTransition('rejected', 'screening')).toEqual({ ok: false, reason: 'terminal_stage' });
  });

  it('lets withdrawing follow an offer as the only move', () => {
    expect(canTransition('offer', 'withdrawn')).toEqual({ ok: true });
  });

  it('revives a ghosted application to a stage that leads into ghosted', () => {
    expect(canTransition('ghosted', 'final')).toEqual({ ok: true });
  });
});
