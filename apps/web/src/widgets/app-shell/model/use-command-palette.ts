import type { Stage } from '@jobflow/shared';
import { type KeyboardEvent as ReactKeyboardEvent, useState } from 'react';

import { isSearchable, type MovingApplication } from '@/entities/application';
import type { ApplicationSearch } from '@/features/search-applications';
import { FEATURE_FLAGS } from '@/shared/config';
import { uk } from '@/shared/i18n';
import { type PageCommand, usePageCommands } from '@/shared/lib/page-commands';
import type { DialogState } from '@/shared/ui/dialog';

import {
  type PaletteAction,
  paletteActionsOf,
  type PalettePage,
  palettePagesOf,
} from './palette-commands';
import { readRecentApplications, type RecentApplication } from './recent-applications';
import { usePaletteMove } from './use-palette-move';
import { type PalettePageId, usePaletteRuns } from './use-palette-runs';
import { usePaletteSearch } from './use-palette-search';
import { usePaletteTarget, useUserId, useViewedApplication } from './use-palette-target';
import type { ShellSurfaces } from './use-shell-surfaces';

export type PaletteRootView = Readonly<{
  text: string;
  search: ApplicationSearch;
  recents: readonly RecentApplication[];
  pages: readonly PalettePage[];
  actions: readonly PaletteAction[];
  commands: readonly PageCommand[];
}>;

const PALETTE = uk.shell.palette;

type RootViewInput = Readonly<{
  open: boolean;
  text: string;
  search: ApplicationSearch;
  target: MovingApplication | undefined;
}>;

function usePalettePage(surfaces: ShellSurfaces) {
  const [page, setPage] = useState<PalettePageId>('root');
  const [text, setText] = useState('');
  const goTo = (next: PalettePageId) => {
    setPage(next);
    setText('');
  };
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (page !== 'move' || event.key !== 'Backspace' || text !== '') return;
    event.preventDefault();
    goTo('root');
  };
  const onOpenChange: DialogState['onOpenChange'] = (open) => {
    if (!open) surfaces.closeThen();
  };
  const handlers = {
    onEscapeKeyDown: (event: KeyboardEvent) => {
      if (page === 'root') return;
      event.preventDefault();
      goTo('root');
    },
    onCloseAutoFocus: (event: Event) => {
      goTo('root');
      surfaces.onCloseAutoFocus(event);
    },
  };
  const dialog = { state: { open: surfaces.surface === 'palette', onOpenChange }, handlers };
  return { page, text, setText, goTo, onKeyDown, dialog };
}

function useRootView({ open, text, search, target }: RootViewInput): PaletteRootView {
  const userId = useUserId();
  const commands = usePageCommands();
  return {
    text,
    search,
    recents: open && userId !== undefined ? readRecentApplications(userId) : [],
    pages: palettePagesOf(FEATURE_FLAGS),
    actions: paletteActionsOf(FEATURE_FLAGS, target),
    commands,
  };
}

function waitingFor(search: ApplicationSearch, text: string): ApplicationSearch | undefined {
  const asked = isSearchable(text.trim()) && (search.isPending || search.isError);
  return asked ? search : undefined;
}

export function useCommandPalette(surfaces: ShellSurfaces) {
  const { page, text, setText, goTo, onKeyDown, dialog } = usePalettePage(surfaces);
  const { open } = dialog.state;
  const viewed = useViewedApplication();
  const target = usePaletteTarget({ opener: surfaces.opener, open, viewed });
  const search = usePaletteSearch(page === 'root' ? text : '');
  const view = useRootView({ open, text, search, target });
  const actions = usePaletteRuns({ surfaces, goTo });
  const { moveTo, rejection } = usePaletteMove(surfaces.opener);
  const moving = page === 'move' ? target : undefined;
  const onMove = (toStage: Stage) => {
    if (moving === undefined) return;
    surfaces.closeThen(() => {
      moveTo({ application: moving, toStage });
    });
  };
  const placeholder = moving ? PALETTE.movePlaceholder(moving.company) : PALETTE.placeholder;
  return {
    field: { text, setText, onKeyDown, placeholder },
    dialog,
    root: { view, actions },
    move: moving && { application: moving, onMove },
    waiting: page === 'root' ? waitingFor(search, text) : undefined,
    rejection,
  };
}

export type CommandPaletteModel = ReturnType<typeof useCommandPalette>;
