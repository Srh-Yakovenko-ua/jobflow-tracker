import { type Stage, STAGES } from '@jobflow/shared';
import { type LucideIcon, Table2 } from 'lucide-react';

import type { MovingApplication } from '@/entities/application';
import { isLegalDrop } from '@/features/move-application';
import type { FeatureFlag, FeatureFlags } from '@/shared/config';
import { uk } from '@/shared/i18n';

import { isFlagOn, visibleNavItems } from './nav-items';

export type PaletteRun =
  | Readonly<{ kind: 'navigate'; href: string }>
  | Readonly<{ kind: 'move' }>
  | Readonly<{ kind: 'theme' }>
  | Readonly<{ kind: 'shortcuts' }>;

export type ShortcutTarget = Extract<PaletteRun, { kind: 'navigate' | 'shortcuts' }>;

export type ShortcutKey = Readonly<{ key: string; code: string; shift?: boolean }>;

export type ShortcutId = keyof typeof uk.shell.shortcuts.items;

export type Shortcut = Readonly<{
  id: ShortcutId;
  keys: readonly ShortcutKey[];
  target: ShortcutTarget;
  flag?: FeatureFlag;
}>;

export type PalettePage = Readonly<{ id: string; label: string; href: string; icon: LucideIcon }>;

export type PaletteActionId = keyof typeof uk.shell.palette.actions;

export type PaletteAction = Readonly<{ id: PaletteActionId; run: PaletteRun }>;

type PaletteTarget = MovingApplication | undefined;

type ActionRow = Readonly<{
  id: PaletteActionId;
  flag?: FeatureFlag;
  runFor: (target: PaletteTarget) => PaletteRun | undefined;
}>;

function navigate(href: string): ShortcutTarget {
  return { kind: 'navigate', href };
}

function letter(key: string): ShortcutKey {
  return { key, code: `Key${key.toUpperCase()}` };
}

export const SHORTCUTS: readonly Shortcut[] = [
  { id: 'add', keys: [letter('n')], target: navigate('/add'), flag: 'addApplication' },
  { id: 'board', keys: [letter('g'), letter('b')], target: navigate('/board') },
  {
    id: 'analytics',
    keys: [letter('g'), letter('a')],
    target: navigate('/analytics'),
    flag: 'analytics',
  },
  {
    id: 'reminders',
    keys: [letter('g'), letter('r')],
    target: navigate('/reminders'),
    flag: 'reminders',
  },
  {
    id: 'shortcuts',
    keys: [{ key: '?', code: 'Slash', shift: true }],
    target: { kind: 'shortcuts' },
  },
];

export function legalMovesFrom(stage: Stage): readonly Stage[] {
  return STAGES.filter((to) => isLegalDrop({ from: stage, to }));
}

const ACTION_ROWS: readonly ActionRow[] = [
  { id: 'add', flag: 'addApplication', runFor: () => navigate('/add') },
  { id: 'paste', flag: 'addApplication', runFor: () => navigate('/add?path=paste') },
  {
    id: 'move',
    runFor: (target) =>
      target && legalMovesFrom(target.currentStage).length > 0 ? { kind: 'move' } : undefined,
  },
  {
    id: 'followUp',
    flag: 'followUp',
    runFor: (target) => target && navigate(`/applications/${target.id}#follow-up`),
  },
  { id: 'analytics', flag: 'analytics', runFor: () => navigate('/analytics') },
  { id: 'theme', runFor: () => ({ kind: 'theme' }) },
  { id: 'shortcuts', runFor: () => ({ kind: 'shortcuts' }) },
];

const TABLE_PAGE: PalettePage = {
  id: 'table',
  label: uk.board.views.table,
  href: '/applications',
  icon: Table2,
};

export function shortcutsOf(flags: FeatureFlags): readonly Shortcut[] {
  return SHORTCUTS.filter((shortcut) => isFlagOn(flags, shortcut.flag));
}

export function palettePagesOf(flags: FeatureFlags): readonly PalettePage[] {
  const pages = visibleNavItems(flags).map((item) => ({
    id: item.id,
    label: uk.shell.nav[item.id],
    href: item.href,
    icon: item.icon,
  }));
  return [...pages, TABLE_PAGE];
}

export function paletteActionsOf(flags: FeatureFlags, target: PaletteTarget): PaletteAction[] {
  return ACTION_ROWS.flatMap((row) => {
    const run = isFlagOn(flags, row.flag) ? row.runFor(target) : undefined;
    return run === undefined ? [] : [{ id: row.id, run }];
  });
}
