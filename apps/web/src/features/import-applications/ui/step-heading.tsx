export type StepHeadingProps = Readonly<{ title: string; detail: string }>;

export function StepHeading({ title, detail }: StepHeadingProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h2 className="text-[17px] leading-[1.3] font-semibold text-ink">{title}</h2>
      <p className="text-[13px] leading-[1.5] break-words text-ink-3 tabular-nums">{detail}</p>
    </div>
  );
}
