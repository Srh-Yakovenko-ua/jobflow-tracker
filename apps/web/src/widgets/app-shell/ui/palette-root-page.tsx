'use client';

import {
  ArrowRightLeft,
  ChartColumn,
  ClipboardPaste,
  History,
  Keyboard,
  type LucideIcon,
  MessageSquareText,
  Plus,
  SlidersHorizontal,
  SunMoon,
} from 'lucide-react';

import { isSearchable } from '@/entities/application';
import {
  ApplicationOptionContent,
  ApplicationResultItem,
  SearchRetryItem,
} from '@/features/search-applications';
import { uk } from '@/shared/i18n';

import type { PaletteActionId } from '../model/palette-commands';
import type { PaletteRootView } from '../model/use-command-palette';
import type { PaletteRootActions } from '../model/use-palette-runs';
import { PaletteGroup, PaletteRow } from './palette-row';

export type PaletteRootPageProps = Readonly<{
  view: PaletteRootView;
  actions: PaletteRootActions;
}>;

const PALETTE = uk.shell.palette;

const ACTION_ICONS: Record<PaletteActionId, LucideIcon> = {
  add: Plus,
  paste: ClipboardPaste,
  move: ArrowRightLeft,
  followUp: MessageSquareText,
  analytics: ChartColumn,
  theme: SunMoon,
  shortcuts: Keyboard,
};

function foundBy(view: PaletteRootView) {
  return isSearchable(view.text.trim()) ? view.search : undefined;
}

function RecentGroup({ view, actions }: PaletteRootPageProps) {
  const found = new Set(foundBy(view)?.data?.items.map((application) => application.id));
  const recents = view.recents.filter((recent) => !found.has(recent.id));
  if (recents.length === 0) return null;
  return (
    <PaletteGroup label={PALETTE.groups.recent}>
      {recents.map((recent) => (
        <PaletteRow
          key={recent.id}
          item={{
            value: `recent:${recent.id}`,
            label: recent.position,
            keywords: [recent.company],
            icon: History,
          }}
          onSelect={() => {
            actions.onOpenApplication(recent);
          }}
        >
          <ApplicationOptionContent application={recent} />
        </PaletteRow>
      ))}
    </PaletteGroup>
  );
}

function FoundGroup({ view, actions }: PaletteRootPageProps) {
  const search = foundBy(view);
  const items = search?.data?.items ?? [];
  if (search === undefined || (items.length === 0 && !search.isError)) return null;
  return (
    <PaletteGroup label={PALETTE.groups.applications} forceMount={items.length === 0}>
      {items.map((application) => (
        <ApplicationResultItem
          key={application.id}
          application={application}
          onPick={actions.onOpenApplication}
        />
      ))}
      <SearchRetryItem search={search} forceMount />
    </PaletteGroup>
  );
}

export function PaletteRootPage({ view, actions }: PaletteRootPageProps) {
  return (
    <>
      <RecentGroup view={view} actions={actions} />
      <PaletteGroup label={PALETTE.groups.pages}>
        {view.pages.map((page) => (
          <PaletteRow
            key={page.href}
            item={{ value: `page:${page.href}`, label: page.label, icon: page.icon }}
            onSelect={() => {
              actions.onRun({ kind: 'navigate', href: page.href });
            }}
          />
        ))}
      </PaletteGroup>
      <PaletteGroup label={PALETTE.groups.actions}>
        {view.actions.map((action) => (
          <PaletteRow
            key={action.id}
            item={{
              value: `action:${action.id}`,
              label: PALETTE.actions[action.id],
              icon: ACTION_ICONS[action.id],
            }}
            onSelect={() => {
              actions.onRun(action.run);
            }}
          />
        ))}
        {view.commands.map((command) => (
          <PaletteRow
            key={command.id}
            item={{ ...command, value: `command:${command.id}`, icon: SlidersHorizontal }}
            onSelect={() => {
              actions.onCommand(command);
            }}
          />
        ))}
      </PaletteGroup>
      <FoundGroup view={view} actions={actions} />
    </>
  );
}
