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
  singleKeys: boolean;
  handlers?: Pick<DialogContentHandlers, 'onCloseAutoFocus'>;
}>;

type ShortcutRow = Readonly<{
  id: string;
  label: string;
  keys: readonly string[];
  chord: boolean;
  off: boolean;
}>;

type RowsInput = Readonly<{
  shortcuts: readonly Shortcut[];
  paletteKeys: readonly string[];
  singleKeys: boolean;
}>;

const COPY = uk.shell.shortcuts;

function rowsOf({ shortcuts, paletteKeys, singleKeys }: RowsInput): ShortcutRow[] {
  const off = !singleKeys;
  const listed = shortcuts.map((shortcut) => ({
    id: shortcut.id,
    label: COPY.items[shortcut.id],
    keys: shortcut.keys.map((key) => key.key.toUpperCase()),
    chord: true,
    off,
  }));
  return [
    { id: 'palette', label: COPY.palette, keys: paletteKeys, chord: false, off: false },
    { id: 'search', label: COPY.search, keys: [SEARCH_SHORTCUT], chord: false, off },
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
      {row.off && <span className="caption text-ink-3">{COPY.off}</span>}
    </dd>
  );
}

export function ShortcutsDialog({
  state,
  shortcuts,
  singleKeys,
  handlers = {},
}: ShortcutsDialogProps) {
  const rows = rowsOf({ shortcuts, paletteKeys: usePaletteKeys(), singleKeys });
  const header = { title: COPY.title, description: singleKeys ? undefined : COPY.offNote };
  return (
    <Dialog open={state.open} onOpenChange={state.onOpenChange}>
      <DialogContent header={header} handlers={handlers}>
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
