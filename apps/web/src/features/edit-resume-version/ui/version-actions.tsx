'use client';

import { type ResumeVersion, resumeVersionLabel } from '@jobflow/shared';
import { Archive, ArchiveRestore, CircleCheck, Ellipsis, Pencil } from 'lucide-react';
import { useRef, useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/shared/ui/menu';

import { fileFormatOf } from '../lib/file-format';
import { usePreviewVersion } from '../model/use-preview-version';
import {
  useActivateVersionMutation,
  useArchiveVersionMutation,
} from '../model/use-version-mutations';
import { RenameVersionDialog } from './rename-version-dialog';

const COPY = uk.resumes;

const ICON = { 'aria-hidden': true, size: 16, strokeWidth: 1.9 } as const;

const ON_ACTIVE_ROW = 'bg-surface shadow-e1';

export type VersionActionsView = Readonly<{ active: boolean }>;

export type VersionActionsProps = Readonly<{ version: ResumeVersion; view: VersionActionsView }>;

type VersionMenuProps = VersionActionsProps & Readonly<{ onRename: () => void }>;

function VersionMenu({ version, view, onRename }: VersionMenuProps) {
  const activate = useActivateVersionMutation();
  const archive = useArchiveVersionMutation();
  const renameChosenRef = useRef(false);
  const { isArchived } = version;
  return (
    <MenuContent
      onCloseAutoFocus={(event) => {
        if (!renameChosenRef.current) return;
        renameChosenRef.current = false;
        event.preventDefault();
        onRename();
      }}
    >
      {!view.active && !isArchived && (
        <MenuItem
          onSelect={() => {
            activate.mutate(version.id);
          }}
        >
          <CircleCheck {...ICON} />
          {COPY.menu.activate}
        </MenuItem>
      )}
      <MenuItem
        onSelect={() => {
          renameChosenRef.current = true;
        }}
      >
        <Pencil {...ICON} />
        {COPY.menu.rename}
      </MenuItem>
      <MenuItem
        onSelect={() => {
          archive.mutate({ id: version.id, isArchived: !isArchived });
        }}
      >
        {isArchived ? <ArchiveRestore {...ICON} /> : <Archive {...ICON} />}
        {isArchived ? COPY.menu.restore : COPY.menu.archive}
      </MenuItem>
    </MenuContent>
  );
}

export function VersionActions({ version, view }: VersionActionsProps) {
  const preview = usePreviewVersion();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [renaming, setRenaming] = useState(false);
  const label = resumeVersionLabel(version);
  const format = fileFormatOf(version);
  const look = cn(view.active && ON_ACTIVE_ROW);
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        aria-label={COPY.previewLabel(format, label)}
        className={look}
        onClick={() => {
          preview(version.id);
        }}
      >
        {format}
      </Button>
      <Menu>
        <MenuTrigger asChild>
          <Button
            ref={triggerRef}
            variant="outline"
            size="sm"
            aria-label={COPY.actionsLabel(label)}
            className={look}
            icon={<Ellipsis {...ICON} />}
          />
        </MenuTrigger>
        <VersionMenu
          version={version}
          view={view}
          onRename={() => {
            setRenaming(true);
          }}
        />
      </Menu>
      <RenameVersionDialog
        version={renaming ? version : null}
        actions={{
          onClose: () => {
            setRenaming(false);
          },
        }}
        handlers={{
          onCloseAutoFocus: (event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          },
        }}
      />
    </div>
  );
}
