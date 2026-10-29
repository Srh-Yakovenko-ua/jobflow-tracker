import { ChevronDown } from 'lucide-react';

export function SelectIndicators() {
  return (
    <span aria-hidden className="flex flex-none items-center gap-1.5">
      <span className="h-4.5 w-px bg-line group-data-invalid:bg-danger/30" />
      <span className="flex size-6 items-center justify-center text-ink-3 group-has-[[data-state=open]]:text-accent-press group-data-invalid:text-danger group-data-[state=open]:text-accent-press">
        <ChevronDown
          size={15}
          className="transition-transform duration-(--duration-base) ease-standard group-has-[[data-state=open]]:rotate-180 group-data-[state=open]:rotate-180"
        />
      </span>
    </span>
  );
}
