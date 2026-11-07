'use client';

import { Command, useCommandState } from 'cmdk';
import { Search } from 'lucide-react';

import { SEARCH_LIMITS } from '@/entities/application';
import { RejectionReasonDialog } from '@/features/reject-with-reason';
import { type ApplicationSearch, SearchStatus } from '@/features/search-applications';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { CommandDialog } from '@/shared/ui/command-dialog';
import { FIELD_SURFACE } from '@/shared/ui/field-surface';
import { KeyHint, ListKeyHints } from '@/shared/ui/kbd';
import { NoMatches } from '@/shared/ui/no-matches';

import { paletteFilter } from '../model/palette-filter';
import { type CommandPaletteModel, useCommandPalette } from '../model/use-command-palette';
import type { ShellSurfaces } from '../model/use-shell-surfaces';
import { PaletteMovePage } from './palette-move-page';
import { PaletteRootPage } from './palette-root-page';

export type CommandPaletteProps = Readonly<{ surfaces: ShellSurfaces }>;

const PALETTE = uk.shell.palette;

function PaletteField({ field }: Readonly<{ field: CommandPaletteModel['field'] }>) {
  return (
    <div className="border-b border-line-soft p-3">
      <div className={cn(FIELD_SURFACE.shell, FIELD_SURFACE.height.field, 'gap-2.5 px-3')}>
        <Search aria-hidden size={16} className="flex-none text-ink-3" />
        <Command.Input
          value={field.text}
          onValueChange={field.setText}
          placeholder={field.placeholder}
          maxLength={SEARCH_LIMITS.maxLength}
          data-focus="halo"
          className={FIELD_SURFACE.control}
        />
      </div>
    </div>
  );
}

function PaletteStatus({ waiting }: Readonly<{ waiting: ApplicationSearch | undefined }>) {
  const shown = useCommandState((state) => state.filtered.count);
  if (waiting !== undefined) return <SearchStatus search={waiting} />;
  return shown === 0 ? <NoMatches /> : null;
}

function PaletteFooter({ moving }: Readonly<{ moving: boolean }>) {
  return (
    <div className="caption hidden items-center gap-3 border-t border-line-soft px-4 py-2.5 text-ink-3 sm:flex">
      <ListKeyHints />
      <KeyHint keys={uk.ui.keys.escape}>{moving ? PALETTE.back : PALETTE.close}</KeyHint>
    </div>
  );
}

export function CommandPalette({ surfaces }: CommandPaletteProps) {
  const palette = useCommandPalette(surfaces);
  return (
    <>
      <CommandDialog
        state={palette.dialog.state}
        title={PALETTE.title}
        handlers={palette.dialog.handlers}
      >
        <Command
          label={PALETTE.label}
          loop
          vimBindings={false}
          filter={paletteFilter}
          onKeyDown={palette.field.onKeyDown}
          className="flex min-h-0 flex-1 flex-col"
        >
          <PaletteField field={palette.field} />
          <PaletteStatus waiting={palette.waiting} />
          <Command.List label={PALETTE.label} className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {palette.move ? (
              <PaletteMovePage
                application={palette.move.application}
                onMove={palette.move.onMove}
              />
            ) : (
              <PaletteRootPage view={palette.root.view} actions={palette.root.actions} />
            )}
          </Command.List>
          <PaletteFooter moving={palette.move !== undefined} />
        </Command>
      </CommandDialog>
      <RejectionReasonDialog
        prompt={palette.rejection.prompt}
        actions={palette.rejection.actions}
        handlers={{ onCloseAutoFocus: surfaces.onCloseAutoFocus }}
      />
    </>
  );
}
