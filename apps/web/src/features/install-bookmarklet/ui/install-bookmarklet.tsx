'use client';

import type { CaptureTokenCreated, CaptureTokenListResponse } from '@jobflow/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { type RefCallback, useRef } from 'react';

import { uk } from '@/shared/i18n';
import { useLastPresent } from '@/shared/lib/use-last-present';
import { LoadFailedAlert } from '@/shared/ui/banner';
import { Button } from '@/shared/ui/button';
import { LoadingRegion } from '@/shared/ui/loading-region';
import { TextSkeleton } from '@/shared/ui/skeleton';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { captureTokensQueryOptions } from '../api/capture-tokens';
import { useCreateCaptureTokenMutation } from '../model/use-create-capture-token-mutation';
import { useRevokeCaptureTokensMutation } from '../model/use-revoke-capture-tokens-mutation';
import { BookmarkletButton } from './bookmarklet-button';
import { InstallSteps } from './install-steps';
import { PrivacyNotes } from './privacy-notes';
import { TokenActions } from './token-actions';
import { TokenStatus } from './token-status';

const COPY = uk.bookmarklet;

type ButtonSlotProps = Readonly<{
  list: UseQueryResult<CaptureTokenListResponse>;
  created: CaptureTokenCreated | null;
  create: Readonly<{ pending: boolean; onCreate: () => void }>;
  createButtonRef: RefCallback<HTMLButtonElement>;
}>;

function ButtonSlot({ list, created, create, createButtonRef }: ButtonSlotProps) {
  if (list.isPending) {
    return (
      <LoadingRegion className="w-full max-w-60">
        <TextSkeleton />
      </LoadingRegion>
    );
  }
  if (list.isError) {
    return (
      <LoadFailedAlert
        onRetry={() => {
          void list.refetch();
        }}
      />
    );
  }
  if (created !== null) return <BookmarkletButton token={created.token} />;
  if (list.data.items.length > 0) {
    return (
      <p className="animate-fade-in text-[12.5px] leading-[1.5] text-ink-2">{COPY.shownOnce}</p>
    );
  }
  return (
    <Button
      ref={createButtonRef}
      loading={create.pending}
      className={TOUCH_HEIGHT}
      onClick={create.onCreate}
    >
      {COPY.create}
    </Button>
  );
}

export function InstallBookmarklet() {
  const list = useQuery(captureTokensQueryOptions());
  const create = useCreateCaptureTokenMutation();
  const revoke = useRevokeCaptureTokensMutation();
  const lastCreated = useLastPresent(create.data ?? null);
  const focusRequestRef = useRef(false);
  const focusIfRequested: RefCallback<HTMLButtonElement> = (button) => {
    if (button === null || !focusRequestRef.current) return;
    focusRequestRef.current = false;
    button.focus();
  };
  const items = list.data?.items ?? [];
  const [newest] = items;
  const created = items.some((item) => item.id === lastCreated?.id) ? lastCreated : null;
  return (
    <div className="flex flex-col gap-4">
      <InstallSteps>
        <ButtonSlot
          list={list}
          created={created}
          create={{
            pending: create.isPending,
            onCreate: () => {
              create.mutate();
            },
          }}
          createButtonRef={focusIfRequested}
        />
      </InstallSteps>
      {newest !== undefined && (
        <div className="flex animate-fade-in flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <TokenStatus token={newest} />
          <TokenActions
            regenerate={{
              pending: create.isPending,
              onConfirm: (close) => {
                create.mutate(undefined, { onSuccess: close });
              },
            }}
            revoke={{
              pending: revoke.isPending,
              onConfirm: (close) => {
                focusRequestRef.current = true;
                revoke.mutate(
                  items.map((item) => item.id),
                  {
                    onSuccess: close,
                    onError: () => {
                      focusRequestRef.current = false;
                    },
                  },
                );
              },
            }}
          />
        </div>
      )}
      <PrivacyNotes />
    </div>
  );
}
