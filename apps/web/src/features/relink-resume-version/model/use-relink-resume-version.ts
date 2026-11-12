'use client';

import type { ApplicationResponse, ResumeVersion } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { applicationKeys, timelineKeys } from '@/entities/application';
import { resumeKeys } from '@/entities/resume';
import { isNotFound } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

import { relinkResumeVersion } from '../api/relink-resume-version';

export type RelinkActions = Readonly<{ onRelinked: (versionId: ResumeVersion['id']) => void }>;

export type UseRelinkResumeVersionOptions = Readonly<{
  application: ApplicationResponse;
  actions: RelinkActions;
}>;

export function useRelinkResumeVersion({ application, actions }: UseRelinkResumeVersionOptions) {
  const queryClient = useQueryClient();
  const applicationId = application.id;
  const refresh = (queryKeys: readonly (readonly unknown[])[]) => {
    for (const queryKey of queryKeys) void queryClient.invalidateQueries({ queryKey });
  };
  return useMutation({
    mutationFn: (resumeVersionId: ResumeVersion['id']) =>
      relinkResumeVersion({ applicationId, resumeVersionId }),
    onSuccess: (_, versionId) => {
      refresh([
        applicationKeys.detail(applicationId),
        timelineKeys.detail(applicationId),
        resumeKeys.list(),
      ]);
      actions.onRelinked(versionId);
    },
    onError: (error) => {
      if (!isNotFound(error)) {
        showErrorToast(uk.errors.saveFailed);
        return;
      }
      refresh([resumeKeys.list()]);
      showErrorToast(uk.applicationPage.resume.gone);
    },
  });
}
