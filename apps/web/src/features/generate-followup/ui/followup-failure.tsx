'use client';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { FAILED_MARK } from '@/shared/ui/async-state';
import { Button } from '@/shared/ui/button';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { type FollowupMethods, FollowupRequestShell } from './followup-request-shell';

export type FollowupFailureProps = Readonly<{
  methods: FollowupMethods;
  failure: Readonly<{ timeout: boolean; retrying: boolean }>;
  actions: Readonly<{ onRetry: () => void; onManual: () => void }>;
}>;

const COPY = uk.followup.failed;

const ACTION = cn('h-9', TOUCH_HEIGHT);

export function FollowupFailure({ methods, failure, actions }: FollowupFailureProps) {
  return (
    <FollowupRequestShell
      methods={methods}
      onSubmit={actions.onRetry}
      view={{
        lead: (
          <p
            role="alert"
            className="flex items-start gap-2.25 text-[13.5px] leading-normal text-danger"
          >
            <span className="mt-0.5">{FAILED_MARK}</span>
            <span>{failure.timeout ? COPY.timeout : COPY.other}</span>
          </p>
        ),
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className={ACTION} loading={failure.retrying}>
              {COPY.retry}
            </Button>
            <Button type="button" variant="outline" className={ACTION} onClick={actions.onManual}>
              {COPY.manual}
            </Button>
          </div>
        ),
      }}
    />
  );
}
