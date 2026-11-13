import { DashedBars, EmptyState, type EmptyStateContent } from '@/shared/ui/empty-state';

export type EmptyPlotProps = Readonly<{ content: EmptyStateContent }>;

export function EmptyPlot({ content }: EmptyPlotProps) {
  return (
    <EmptyState
      content={content}
      slots={{ figure: <DashedBars view={{ density: 'compact' }} /> }}
      view={{ size: 'compact' }}
    />
  );
}
