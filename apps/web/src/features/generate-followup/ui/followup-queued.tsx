import { uk } from '@/shared/i18n';
import type { AiJob } from '@/shared/ui/async-state';

export type FollowupQueuedProps = Readonly<{ job: AiJob }>;

export function FollowupQueued({ job }: FollowupQueuedProps) {
  return (
    <>
      {job.status === 'queued' && (
        <span aria-hidden className="block h-1 overflow-hidden bg-surface-3">
          <span className="block h-full w-[34%] bg-accent motion-safe:animate-sweep" />
        </span>
      )}
      <p className="text-[13px] leading-normal text-ink-3">{uk.followup.waiting}</p>
    </>
  );
}
