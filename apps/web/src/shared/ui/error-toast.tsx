import { toast } from 'sonner';

import { uk } from '@/shared/i18n';

export type ErrorToastContent = { title: string; description: string };

type ErrorToastProps = Readonly<{ content: ErrorToastContent; toastId: string | number }>;

const ERROR_TOAST_ID = 'error-toast';

function ErrorToast({ content, toastId }: ErrorToastProps) {
  return (
    <div className="flex w-(--width) max-w-full items-start gap-3 rounded-xl bg-surface px-3.5 py-3.25 font-ui text-ink shadow-e3 inset-shadow-[3px_0_0_var(--rejected)]">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="body font-semibold">{content.title}</p>
        <p className="caption text-ink-2">{content.description}</p>
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(toastId)}
        className="-my-1.5 min-h-11 flex-none self-center rounded-sm px-1.5 text-[12.5px] font-semibold text-accent-press transition-colors duration-(--duration-instant) ease-standard hover:bg-accent-tint"
      >
        {uk.app.close}
      </button>
    </div>
  );
}

export function showErrorToast(content: ErrorToastContent): void {
  toast.custom((toastId) => <ErrorToast content={content} toastId={toastId} />, {
    id: ERROR_TOAST_ID,
  });
}
