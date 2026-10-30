import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import { SectionHeader } from '../../design-system/section-header';

export const PANEL = 'flex flex-col gap-5 rounded-lg bg-surface p-5 shadow-e1';

export const TILE_GRID = 'grid grid-cols-[repeat(auto-fit,minmax(min(238px,100%),1fr))] gap-4.5';

export const STATE_GRID =
  'grid grid-cols-[repeat(auto-fit,minmax(min(288px,100%),1fr))] items-start gap-5';

export type GallerySectionProps = Readonly<{
  header: { index: string; title: string };
  children: ReactNode;
}>;

export function GallerySection({ header, children }: GallerySectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader header={header} size="section" />
      {children}
    </section>
  );
}

export type SpecimenProps = Readonly<{
  eyebrow: string;
  children: ReactNode;
  className?: string;
}>;

export function Specimen({ eyebrow, children, className }: SpecimenProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2.5', className)}>
      <span className="eyebrow text-ink-3">{eyebrow}</span>
      {children}
    </div>
  );
}

export function Note({ children }: Readonly<{ children: ReactNode }>) {
  return <p className="caption text-ink-3">{children}</p>;
}

export type StateRuleProps = Readonly<{ rule: { title: string; text: string } }>;

export function StateRule({ rule }: StateRuleProps) {
  return (
    <Specimen eyebrow={rule.title} className="max-w-[72ch]">
      <p className="body text-ink-2">{rule.text}</p>
    </Specimen>
  );
}

export function Divider() {
  return <span aria-hidden className="h-px bg-line-soft" />;
}
