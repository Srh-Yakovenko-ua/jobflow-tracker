import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

const COPY = uk.auth.promise;

const FUNNEL_BARS = [
  { id: 'applied', height: 'h-full', colour: 'bg-data-2' },
  { id: 'screening', height: 'h-[62%]', colour: 'bg-data-3' },
  { id: 'interview', height: 'h-[40%]', colour: 'bg-data-5' },
  { id: 'final', height: 'h-[22%]', colour: 'bg-data-6' },
  { id: 'offer', height: 'h-[9%]', colour: 'bg-offer' },
] as const;

export function PromisePanel() {
  const [opening, middle, closing] = COPY.headline;
  return (
    <div
      data-theme="dark"
      className="flex flex-col justify-between gap-10 bg-scrim px-9 py-10 text-ink sm:order-first"
    >
      <span className="font-display text-[24px] font-semibold">{uk.app.brand}</span>
      <div className="flex flex-col gap-5">
        <h2 className="font-display text-[clamp(28px,3.4vw,40px)] leading-[1.1] font-normal text-pretty">
          {opening} <br />
          {middle} <br />
          <span className="italic">{closing}</span>
        </h2>
        <p className="max-w-[40ch] text-[15px] leading-[1.6] text-ink-2">{COPY.lead}</p>
      </div>
      <div className="flex flex-col gap-2.5">
        <div aria-hidden className="flex h-14 items-end gap-0.5">
          {FUNNEL_BARS.map((bar) => (
            <span key={bar.id} className={cn('flex-1', bar.height, bar.colour)} />
          ))}
        </div>
        <span className="eyebrow text-ink-3">{COPY.caption}</span>
      </div>
    </div>
  );
}
