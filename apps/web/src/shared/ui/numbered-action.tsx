import { cn } from '@/shared/lib/cn';

const TONES = {
  accent: 'bg-accent-tint text-accent-ink',
  link: 'bg-surface-2 text-link',
} as const;

export type NumberedActionTone = keyof typeof TONES;

export type NumberedActionContent = Readonly<{
  position: number;
  title: string;
  lines: readonly string[];
}>;

export type NumberedActionProps = Readonly<{
  action: NumberedActionContent;
  view: Readonly<{ tone: NumberedActionTone }>;
}>;

export function NumberedAction({ action, view }: NumberedActionProps) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className={cn(
          'grid size-5.5 flex-none place-items-center rounded-[7px] text-[11px] font-semibold tabular-nums',
          TONES[view.tone],
        )}
      >
        {action.position}
      </span>
      <div className="flex min-w-0 flex-col gap-0.75">
        <p className="text-[13.5px] leading-[1.4] font-semibold text-pretty text-ink">
          {action.title}
        </p>
        {action.lines.map((line) => (
          <p
            key={line}
            className="text-[12.5px] leading-normal text-pretty text-ink-2 tabular-nums"
          >
            {line}
          </p>
        ))}
      </div>
    </li>
  );
}
