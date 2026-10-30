import { cn } from '@/shared/lib/cn';

export type BannerTone = 'info' | 'error';

export type BannerContent = { title: string; description: string };

type BannerLook = { role: 'status' | 'alert'; ring: string; dot: string };

const TONES: Record<BannerTone, BannerLook> = {
  info: { role: 'status', ring: 'inset-ring-accent/25', dot: 'bg-accent' },
  error: { role: 'alert', ring: 'inset-ring-rejected/30', dot: 'bg-rejected' },
};

export type BannerProps = Readonly<{ tone: BannerTone; content: BannerContent }>;

export function Banner({ tone, content }: BannerProps) {
  const look = TONES[tone];
  return (
    <div
      role={look.role}
      className={cn(
        'flex min-w-0 items-start gap-2.75 rounded-[10px] bg-surface px-3.5 py-3.25 inset-ring',
        look.ring,
      )}
    >
      <span aria-hidden className={cn('mt-1.25 size-2 flex-none rounded-pill', look.dot)} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[13px] leading-[1.35] font-semibold text-ink">{content.title}</p>
        <p className="text-[12px] leading-[1.45] text-ink-2">{content.description}</p>
      </div>
    </div>
  );
}
