'use client';

import { type ApplicationResponse, type ResumeVersion, resumeVersionLabel } from '@jobflow/shared';
import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from '@/shared/ui/menu';
import { Spinner } from '@/shared/ui/spinner';

import { type RelinkActions, useRelinkResumeVersion } from '../model/use-relink-resume-version';

export type VersionPickerProps = Readonly<{
  application: ApplicationResponse;
  versions: readonly ResumeVersion[];
  actions: RelinkActions;
}>;

const COPY = uk.applicationPage.resume;

export function VersionPicker({ application, versions, actions }: VersionPickerProps) {
  const relink = useRelinkResumeVersion({ application, actions });
  const [open, setOpen] = useState(false);
  const linkedId = application.resumeVersionId;
  const pending = relink.isPending;
  const choices = versions.filter(({ id, isArchived }) => !isArchived || id === linkedId);
  return (
    <Menu
      open={open}
      onOpenChange={(next) => {
        setOpen(next && !pending);
      }}
    >
      <MenuTrigger asChild>
        <Button
          variant="ghost"
          aria-disabled={pending || undefined}
          aria-busy={pending || undefined}
          icon={pending ? <Spinner /> : undefined}
          className="px-2"
        >
          {COPY.change}
        </Button>
      </MenuTrigger>
      <MenuContent align="start" aria-label={COPY.versions}>
        <MenuRadioGroup
          value={linkedId ?? ''}
          onValueChange={(versionId) => {
            if (versionId !== linkedId) relink.mutate(versionId);
          }}
        >
          {choices.map((version) => (
            <MenuRadioItem key={version.id} value={version.id}>
              {resumeVersionLabel(version)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
