import type { Source } from '@jobflow/shared';

export const SOURCE_ROWS: readonly { source: Source; count: string; share: string }[] = [
  { source: 'djinni', count: '24', share: '38%' },
  { source: 'dou', count: '11', share: '18%' },
  { source: 'linkedin', count: '16', share: '13%' },
];

export const TYPE_ROLES = [
  { role: 'num', token: 'num · Unbounded 600' },
  { role: 'display', token: 'display 19–48' },
  { role: 'title', token: 'title 16/600' },
  { role: 'body-l', token: 'body-l 14.5/1.6' },
  { role: 'body', token: 'body 13.5/1.55' },
  { role: 'label', token: 'label 12/600' },
  { role: 'caption', token: 'caption 11.5/1.5' },
  { role: 'eyebrow', token: 'eyebrow 11/.14em' },
] as const;

export const SURFACE_SWATCHES = [
  { label: '22%', swatch: 'bg-paper inset-ring inset-ring-line' },
  { label: '27%', swatch: 'bg-surface' },
  { label: 'accent', swatch: 'bg-linear-140 from-accent to-accent-press' },
] as const;
