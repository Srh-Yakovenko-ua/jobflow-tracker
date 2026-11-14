'use client';

import { uk } from '@/shared/i18n';
import { Button, type ButtonVariant } from '@/shared/ui/button';
import { InlineAlert } from '@/shared/ui/inline-alert';

import { useRegenerateSummary } from '../model/use-regenerate-summary';

export type RegenerateSummaryButtonProps = Readonly<{
  view?: { variant?: ButtonVariant; label?: string };
}>;

export function RegenerateSummaryButton({ view }: RegenerateSummaryButtonProps) {
  const summary = useRegenerateSummary();
  return (
    <>
      <Button
        variant={view?.variant ?? 'secondary'}
        loading={summary.isPending}
        onClick={summary.regenerate}
      >
        {view?.label ?? uk.summary.regenerate.action}
      </Button>
      <InlineAlert message={summary.refusal} className="basis-full" />
    </>
  );
}
