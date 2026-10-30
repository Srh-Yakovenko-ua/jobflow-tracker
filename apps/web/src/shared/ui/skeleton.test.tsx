import { render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';

import { CardSkeleton, ChartSkeleton, ColumnSkeleton, TextSkeleton } from './skeleton';

type ManyProps = Readonly<{ count: number; Skeleton: ComponentType }>;

function Many({ count, Skeleton }: ManyProps) {
  const ids = Array.from({ length: count }, (_, slot) => `skeleton-${String(slot)}`);
  return ids.map((id) => <Skeleton key={id} />);
}

function shimmeringBars(container: HTMLElement): number {
  return container.querySelectorAll('[class*="animate-shimmer"]').length;
}

function staticFills(container: HTMLElement): number {
  return container.querySelectorAll('[class*="bg-surface-3"]').length;
}

describe('skeleton motion', () => {
  it('19 card skeletons shimmer, the 20th turns them all static, and 19 shimmer again', () => {
    const { container, rerender } = render(<Many count={19} Skeleton={CardSkeleton} />);
    expect(shimmeringBars(container)).toBe(38);

    rerender(<Many count={20} Skeleton={CardSkeleton} />);
    expect(shimmeringBars(container)).toBe(0);
    expect(staticFills(container)).toBe(60);

    rerender(<Many count={19} Skeleton={CardSkeleton} />);
    expect(shimmeringBars(container)).toBe(38);
  });

  it('a board of 10 column skeletons counts its 20 cards and stays static', () => {
    const { container } = render(<Many count={10} Skeleton={ColumnSkeleton} />);

    expect(shimmeringBars(container)).toBe(0);
  });

  it('chart and text skeletons count toward the same page-wide limit', () => {
    const { container } = render(
      <>
        <Many count={18} Skeleton={CardSkeleton} />
        <ChartSkeleton />
        <TextSkeleton />
      </>,
    );

    expect(shimmeringBars(container)).toBe(0);
  });

  it('one chart skeleton shimmers only its number bar, its plot bars stay still', () => {
    const { container } = render(<ChartSkeleton />);

    expect(shimmeringBars(container)).toBe(1);
  });
});
