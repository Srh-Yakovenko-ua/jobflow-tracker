import { uk } from '@/shared/i18n';
import { formatDuration } from '@/shared/lib/state-format';
import { Banner } from '@/shared/ui/banner';

export type RateLimitAlertProps = Readonly<{ secondsLeft: number | undefined }>;

const COPY = uk.auth.alerts.rateLimited;

export function RateLimitAlert({ secondsLeft }: RateLimitAlertProps) {
  if (secondsLeft === 0) return null;
  const description =
    secondsLeft === undefined ? (
      COPY.later
    ) : (
      <>
        {COPY.retryIn}{' '}
        <span role="timer" aria-live="off" className="tabular-nums">
          {formatDuration(secondsLeft)}
        </span>
      </>
    );
  return <Banner tone="error" content={{ title: COPY.title, description }} />;
}
