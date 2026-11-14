'use client';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { FAILED_MARK } from '@/shared/ui/async-state';
import { Button } from '@/shared/ui/button';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import type { FollowupFailed } from '../lib/followup-view';
import type { FollowupMethods } from './followup-choices';
import { FollowupRequestShell } from './followup-request-shell';

export type FollowupFailureAlertProps = Readonly<{
  failure: FollowupFailed & Readonly<{ retrying: boolean }>;
  actions: Readonly<{ onRetry: () => void; onManual: () => void }>;
}>;

export type FollowupFailureProps = FollowupFailureAlertProps &
  Readonly<{ methods: FollowupMethods }>;

const COPY = uk.followup.failed;

const ACTION = cn('h-9', TOUCH_HEIGHT);

function FailureLine({ timeout }: FollowupFailed) {
  return (
    <p role="alert" className="flex items-start gap-2.25 text-[13.5px] leading-normal text-danger">
      <span className="mt-0.5">{FAILED_MARK}</span>
      <span>{timeout ? COPY.timeout : COPY.other}</span>
    </p>
  );
}

function FailureButtons({ failure, actions }: FollowupFailureAlertProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button className={ACTION} loading={failure.retrying} onClick={actions.onRetry}>
        {COPY.retry}
      </Button>
      <Button variant="outline" className={ACTION} onClick={actions.onManual}>
        {COPY.manual}
      </Button>
    </div>
  );
}

export function FollowupFailureAlert(props: FollowupFailureAlertProps) {
  return (
    <div className="flex flex-col gap-3">
      <FailureLine timeout={props.failure.timeout} />
      <FailureButtons {...props} />
    </div>
  );
}

export function FollowupFailure({ methods, ...alert }: FollowupFailureProps) {
  return (
    <FollowupRequestShell
      methods={methods}
      onSubmit={alert.actions.onRetry}
      view={{
        lead: <FailureLine timeout={alert.failure.timeout} />,
        actions: <FailureButtons {...alert} />,
      }}
    />
  );
}
