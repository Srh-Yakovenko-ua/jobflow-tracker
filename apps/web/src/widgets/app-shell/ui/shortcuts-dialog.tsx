'use client';

import { Fragment } from 'react';

import { SEARCH_SHORTCUT } from '@/features/search-applications';
import { uk } from '@/shared/i18n';
import {
  Dialog,
  DialogContent,
  type DialogContentHandlers,
  type DialogState,
} from '@/shared/ui/dialog';
import { Kbd } from '@/shared/ui/kbd';

import type { Shortcut } from '../model/palette-commands';
import { usePaletteKeys } from '../model/palette-keys';

export type ShortcutsDialogProps = Readonly<{
  state: DialogState;
  shortcuts: readonly Shortcut[];
  handlers?: Pick<DialogContentHandlers, 'onCloseAutoFocus'>;
}>;

type ShortcutRow = Readonly<{ id: string; label: string; keys: readonly string[]; chord: boolean }>;

const COPY = uk.shell.shortcuts;

function rowsOf(shortcuts: readonly Shortcut[], paletteKeys: readonly string[]): ShortcutRow[] {
  const listed = shortcuts.map((shortcut) => ({
    id: shortcut.id,
    label: COPY.items[shortcut.id],
    keys: shortcut.keys.map((key) => key.key.toUpperCase()),
    chord: true,
  }));
  return [
    { id: 'palette', label: COPY.palette, keys: paletteKeys, chord: false },
    { id: 'search', label: COPY.search, keys: [SEARCH_SHORTCUT], chord: false },
    ...listed,
  ];
}

function RowKeys({ row }: Readonly<{ row: ShortcutRow }>) {
  return (
    <dd className="flex flex-none items-center gap-1.5">
      {row.keys.map((key, index) => (
        <Fragment key={key}>
          {row.chord && index > 0 && <span className="caption text-ink-3">{COPY.then}</span>}
          <Kbd>{key}</Kbd>
        </Fragment>
      ))}
    </dd>
  );
}

export function ShortcutsDialog({ state, shortcuts, handlers = {} }: ShortcutsDialogProps) {
  const rows = rowsOf(shortcuts, usePaletteKeys());
  return (
    <Dialog open={state.open} onOpenChange={state.onOpenChange}>
      <DialogContent header={{ title: COPY.title }} handlers={handlers}>
        <dl className="flex flex-col">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex min-h-11 items-center justify-between gap-4 border-b border-line-soft py-2 last:border-b-0"
            >
              <dt className="text-body text-ink">{row.label}</dt>
              <RowKeys row={row} />
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
