'use client';

import type { ResumeVersion } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseFormSetError } from 'react-hook-form';

import {
  activateResumeVersion,
  resumeKeys,
  VERSION_TITLE_FIELDS,
  type VersionTitleForm,
} from '@/entities/resume';
import { userKeys } from '@/entities/user';
import { type GuardedSave, useGuardedSave } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

import { updateResumeVersion } from '../api/version-requests';

export type ArchiveVersionInput = Readonly<{ id: ResumeVersion['id']; isArchived: boolean }>;

export type UseRenameVersionOptions = Readonly<{
  versionId: ResumeVersion['id'];
  setError: UseFormSetError<VersionTitleForm>;
  onSaved: () => void;
}>;

const REFRESHED = [resumeKeys.all, userKeys.me()];

function renameKeyOf(versionId: ResumeVersion['id']) {
  return ['resume-rename', versionId] as const;
}

function useVersionMutation<Input>(request: (input: Input) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onError: () => {
      showErrorToast(uk.errors.saveFailed);
    },
    onSettled: () =>
      Promise.all(REFRESHED.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

export function useActivateVersionMutation() {
  return useVersionMutation(activateResumeVersion);
}

export function useArchiveVersionMutation() {
  return useVersionMutation(({ id, isArchived }: ArchiveVersionInput) =>
    updateResumeVersion({ id, patch: { isArchived } }),
  );
}

export function useRenameVersionMutation({
  versionId,
  setError,
  onSaved,
}: UseRenameVersionOptions): GuardedSave<VersionTitleForm> {
  const queryClient = useQueryClient();
  return useGuardedSave({
    mutationKey: renameKeyOf(versionId),
    request: ({ title }: VersionTitleForm) =>
      updateResumeVersion({ id: versionId, patch: { title } }),
    form: { fields: VERSION_TITLE_FIELDS, setError },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: resumeKeys.all });
      onSaved();
    },
  });
}
