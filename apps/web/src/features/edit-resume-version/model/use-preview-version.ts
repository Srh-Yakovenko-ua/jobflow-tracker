'use client';

import type { ResumeVersion } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { resumeKeys } from '@/entities/resume';
import { isNotFound } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

import { downloadResumeVersion } from '../api/version-requests';

type PreviewRequest = Readonly<{ id: ResumeVersion['id']; tab: Window | null }>;

const BLANK_TAB = 'about:blank';

export function usePreviewVersion(): (id: ResumeVersion['id']) => void {
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: ({ id }: PreviewRequest) => downloadResumeVersion(id),
    onSuccess: ({ url }, { tab }) => {
      tab?.location.assign(url);
    },
    onError: (error, { tab }) => {
      tab?.close();
      if (isNotFound(error)) void queryClient.invalidateQueries({ queryKey: resumeKeys.list() });
      showErrorToast(uk.resumes.errors.previewFailed);
    },
  });
  return (id) => {
    const tab = window.open(BLANK_TAB, '_blank');
    if (tab !== null) tab.opener = null;
    mutate({ id, tab });
  };
}
