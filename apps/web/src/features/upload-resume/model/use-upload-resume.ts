'use client';

import type { ResumeUploadInput, ResumeVersion } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { UseFormSetError } from 'react-hook-form';

import { resumeKeys, VERSION_TITLE_FIELDS, type VersionTitleForm } from '@/entities/resume';
import { userKeys } from '@/entities/user';
import { applyFieldErrors, putFile, type UploadProgress, useSubmitKey } from '@/shared/api';

import { confirmUpload, createTicket, createVersion } from '../api/upload-resume';
import { type UploadFailure, uploadFailureOf } from '../lib/upload-failure';

export type ResumeUploadRequest = Readonly<{ file: File; input: ResumeUploadInput; title: string }>;

export type UploadResume = Readonly<{
  send: (request: ResumeUploadRequest, onUploaded: () => void) => void;
  reset: () => void;
  pending: boolean;
  percent: number | null;
  failure: UploadFailure | null;
}>;

type StoredFile = Readonly<{ file: File; uploadId: string }>;

type StoreFileOptions = Readonly<{
  request: ResumeUploadRequest;
  onPercent: (percent: number) => void;
}>;

const PERCENT = 100;

function percentOf({ loaded, total }: UploadProgress): number {
  return total > 0 ? Math.floor((loaded / total) * PERCENT) : 0;
}

async function storeFile({ request: { file, input }, onPercent }: StoreFileOptions) {
  const ticket = await createTicket(input);
  onPercent(0);
  const onProgress = (progress: UploadProgress) => {
    onPercent(percentOf(progress));
  };
  await putFile({ url: ticket.url, file, headers: ticket.headers, onProgress });
  await confirmUpload({ uploadId: ticket.uploadId, mime: input.mime });
  return ticket.uploadId;
}

function useStoredFile(onPercent: StoreFileOptions['onPercent']) {
  const storedRef = useRef<StoredFile | null>(null);
  return {
    uploadIdFor: async (request: ResumeUploadRequest): Promise<string> => {
      const stored = storedRef.current;
      if (stored?.file === request.file) return stored.uploadId;
      const uploadId = await storeFile({ request, onPercent });
      storedRef.current = { file: request.file, uploadId };
      return uploadId;
    },
    forget: () => {
      storedRef.current = null;
    },
  };
}

export function useUploadResume(setError: UseFormSetError<VersionTitleForm>): UploadResume {
  const queryClient = useQueryClient();
  const submitKey = useSubmitKey();
  const [percent, setPercent] = useState<number | null>(null);
  const stored = useStoredFile(setPercent);
  const mutation = useMutation({
    mutationFn: async (request: ResumeUploadRequest): Promise<ResumeVersion> => {
      const uploadId = await stored.uploadIdFor(request);
      const { filename, mime } = request.input;
      const body = { uploadId, filename, mime, title: request.title };
      return createVersion({ body, idempotencyKey: submitKey.keyFor(body) });
    },
    onSuccess: stored.forget,
    onError: (error, { file }) => {
      const failure = uploadFailureOf({ error, file });
      if (failure.kind !== 'fields') return;
      applyFieldErrors({ error: failure.error, fields: VERSION_TITLE_FIELDS, setError });
    },
    onSettled: () => {
      setPercent(null);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: resumeKeys.all }),
        queryClient.invalidateQueries({ queryKey: userKeys.me() }),
      ]);
    },
  });
  const { error, variables } = mutation;
  return {
    send: (request, onUploaded) => {
      mutation.mutate(request, { onSuccess: onUploaded });
    },
    reset: () => {
      stored.forget();
      mutation.reset();
    },
    pending: mutation.isPending,
    percent,
    failure: error === null ? null : uploadFailureOf({ error, file: variables.file }),
  };
}
