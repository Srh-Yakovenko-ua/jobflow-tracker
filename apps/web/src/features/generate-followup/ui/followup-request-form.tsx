'use client';

import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { type FollowupMethods, FollowupRequestShell } from './followup-request-shell';

export type FollowupRequestFormProps = Readonly<{
  methods: FollowupMethods;
  submit: Readonly<{ pending: boolean; onSubmit: () => void }>;
}>;

const COPY = uk.followup;

export function FollowupRequestForm({ methods, submit }: FollowupRequestFormProps) {
  return (
    <FollowupRequestShell
      methods={methods}
      onSubmit={submit.onSubmit}
      view={{
        lead: <p className="text-[14px] leading-normal text-ink-2">{COPY.idle}</p>,
        actions: (
          <Button type="submit" size="lg" loading={submit.pending} className={TOUCH_HEIGHT}>
            {COPY.generate}
          </Button>
        ),
      }}
    />
  );
}
