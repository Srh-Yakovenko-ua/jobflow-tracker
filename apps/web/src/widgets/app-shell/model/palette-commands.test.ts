import { describe, expect, it } from 'vitest';

import { FEATURE_FLAGS } from '@/shared/config';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { EVERY_FLAG_ON } from '@/test/feature-flags';

import {
  legalMovesFrom,
  paletteActionsOf,
  palettePagesOf,
  type Shortcut,
  shortcutsOf,
} from './palette-commands';

const REJECTED = { ...ACME_APPLICATION, currentStage: 'rejected' as const };

function codesOf(shortcut: Shortcut) {
  return [shortcut.id, shortcut.keys.map((key) => key.code)];
}

function actionsAt(...args: Parameters<typeof paletteActionsOf>) {
  return paletteActionsOf(...args).map((action) => [action.id, action.run]);
}

describe('shortcutsOf', () => {
  it('keeps N, G B and ? while analytics and reminders are behind their flags', () => {
    expect(shortcutsOf(FEATURE_FLAGS).map((shortcut) => shortcut.id)).toEqual([
      'add',
      'board',
      'shortcuts',
    ]);
  });

  it('lists N, G B, G A, G R and ? once every flag is on', () => {
    expect(shortcutsOf(EVERY_FLAG_ON).map(codesOf)).toEqual([
      ['add', ['KeyN']],
      ['board', ['KeyG', 'KeyB']],
      ['analytics', ['KeyG', 'KeyA']],
      ['reminders', ['KeyG', 'KeyR']],
      ['shortcuts', ['Slash']],
    ]);
  });
});

describe('palettePagesOf', () => {
  it('offers the shipped pages plus the table view', () => {
    expect(palettePagesOf(FEATURE_FLAGS).map((page) => [page.label, page.href])).toEqual([
      ['Дошка', '/board'],
      ['Календар', '/calendar'],
      ['Налаштування', '/settings'],
      ['Таблиця', '/applications'],
    ]);
  });
});

describe('paletteActionsOf', () => {
  it('without a focused application and with the shipped flags offers add, paste, the theme and the cheat sheet', () => {
    expect(actionsAt(FEATURE_FLAGS, undefined)).toEqual([
      ['add', { kind: 'navigate', href: '/add' }],
      ['paste', { kind: 'navigate', href: '/add?path=paste' }],
      ['theme', { kind: 'theme' }],
      ['shortcuts', { kind: 'shortcuts' }],
    ]);
  });

  it('a focused application adds the move', () => {
    expect(actionsAt(FEATURE_FLAGS, ACME_APPLICATION).map(([id]) => id)).toEqual([
      'add',
      'paste',
      'move',
      'theme',
      'shortcuts',
    ]);
  });

  it('with every flag on links add, paste, follow-up and analytics to their pages', () => {
    expect(actionsAt(EVERY_FLAG_ON, ACME_APPLICATION)).toEqual([
      ['add', { kind: 'navigate', href: '/add' }],
      ['paste', { kind: 'navigate', href: '/add?path=paste' }],
      ['move', { kind: 'move' }],
      [
        'followUp',
        { kind: 'navigate', href: '/applications/0b6f3c1e-5d2a-4c8e-9f10-000000000201#follow-up' },
      ],
      ['analytics', { kind: 'navigate', href: '/analytics' }],
      ['theme', { kind: 'theme' }],
      ['shortcuts', { kind: 'shortcuts' }],
    ]);
  });

  it('a rejected application has nowhere to move, so the move is left out', () => {
    expect(actionsAt(FEATURE_FLAGS, REJECTED).map(([id]) => id)).toEqual([
      'add',
      'paste',
      'theme',
      'shortcuts',
    ]);
  });
});

describe('legalMovesFrom', () => {
  it.each([
    { from: 'applied', to: ['screening', 'tech_interview', 'rejected', 'ghosted', 'withdrawn'] },
    { from: 'tech_interview', to: ['final', 'offer', 'rejected', 'ghosted', 'withdrawn'] },
    { from: 'offer', to: ['withdrawn'] },
    { from: 'withdrawn', to: [] },
  ] as const)('from $from offers $to', ({ from, to }) => {
    expect(legalMovesFrom(from)).toEqual(to);
  });
});
