'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useState } from 'react';

import { boardQueryOptions, SILENT_ONLY, silentCountOf } from '@/entities/application';
import {
  calendarQueryOptions,
  interviewRangeFrom,
  upcomingInterviewsOf,
} from '@/entities/scheduled-event';
import { FEATURE_FLAGS } from '@/shared/config';
import { uk } from '@/shared/i18n';
import { usePushPermission } from '@/shared/lib/web-push';
import { dismissToast, showToast } from '@/shared/ui/toast';

import { pushPublicKeyQueryOptions } from '../api/push';
import { readOfferDismissed, rememberOfferDismissed } from '../lib/offer-dismissal';
import { useEnablePush } from './use-enable-push';

export type PushOfferActions = Readonly<{ onEnabled?: () => void }>;

export type PushOfferReason = 'silence' | 'interview';

const COPY = uk.push;

const OFFER_TOAST_ID = 'push-offer';

const DENIED_TOAST_ID = 'push-denied';

const STAYS_OPEN = { duration: Infinity } as const;

function focusMain(): void {
  document.getElementById('main')?.focus({ preventScroll: true });
}

function showDeniedSteps(): void {
  showToast(
    {
      tone: 'info',
      ...COPY.denied,
      action: { label: uk.app.close, onAction: focusMain },
    },
    { id: DENIED_TOAST_ID, ...STAYS_OPEN },
  );
}

function useOfferReason({
  eligible,
}: Readonly<{ eligible: boolean }>): PushOfferReason | undefined {
  const [now] = useState(() => new Date());
  const [range] = useState(() => interviewRangeFrom(now));
  const board = useQuery({ ...boardQueryOptions(SILENT_ONLY), enabled: eligible }).data;
  const calendar = useQuery(calendarQueryOptions(eligible ? range : null)).data;
  if (!eligible) return undefined;
  if (board !== undefined && silentCountOf(board) > 0) return 'silence';
  const interviews = calendar && upcomingInterviewsOf({ items: calendar.items, now });
  return interviews !== undefined && interviews.length > 0 ? 'interview' : undefined;
}

function useOfferEligible(): Readonly<{ eligible: boolean; onDismissed: () => void }> {
  const [dismissedNow, setDismissedNow] = useState(false);
  const permission = usePushPermission();
  const open =
    FEATURE_FLAGS.browserPush && permission === 'default' && !dismissedNow && !readOfferDismissed();
  const publicKey = useQuery({ ...pushPublicKeyQueryOptions(), enabled: open }).data?.publicKey;
  return {
    eligible: open && typeof publicKey === 'string',
    onDismissed: () => {
      rememberOfferDismissed();
      setDismissedNow(true);
    },
  };
}

export function usePushOffer({ onEnabled }: PushOfferActions): void {
  const { eligible, onDismissed } = useOfferEligible();
  const reason = useOfferReason({ eligible });
  const { enable } = useEnablePush({ ...(onEnabled && { onEnabled }), onDenied: showDeniedSteps });
  const offer = useEffectEvent((shown: PushOfferReason) => {
    showToast(
      {
        tone: 'info',
        title: COPY.offer.title,
        description: COPY.offer[shown],
        action: {
          label: COPY.offer.enable,
          onAction: () => {
            enable(Notification.requestPermission());
            focusMain();
          },
        },
        dismiss: {
          label: COPY.offer.later,
          onAction: () => {
            onDismissed();
            focusMain();
          },
        },
      },
      { id: OFFER_TOAST_ID, ...STAYS_OPEN },
    );
  });
  useEffect(() => {
    if (reason === undefined) return;
    offer(reason);
    return () => {
      dismissToast(OFFER_TOAST_ID);
    };
  }, [reason]);
}
