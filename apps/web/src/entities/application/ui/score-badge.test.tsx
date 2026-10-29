import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScoreBadge } from './score-badge';

describe('ScoreBadge', () => {
  it('no CV shows a dashed dash named "без CV", never a 0', () => {
    render(<ScoreBadge application={{ matchScore: null, aiStatus: null }} />);

    const badge = screen.getByRole('img', { name: 'без CV' });
    expect(badge.textContent).toBe('—');
    expect(badge.className).toContain('border-dashed');
    expect(screen.queryByText('0')).toBeNull();
  });

  it.each([
    ['queued', 'Match Score у черзі'],
    ['processing', 'AI рахує Match Score'],
    ['failed', 'Match Score не пораховано'],
  ] as const)('a %s AI job hides the stale stored score', (aiStatus, name) => {
    render(<ScoreBadge application={{ matchScore: 91, aiStatus }} />);

    expect(screen.getByRole('img', { name })).toBeDefined();
    expect(screen.queryByText('91')).toBeNull();
  });

  it('only processing runs the shimmer, and only when motion is allowed', () => {
    render(<ScoreBadge application={{ matchScore: null, aiStatus: 'processing' }} />);

    expect(screen.getByRole('img').className).toContain('motion-safe:animate-shimmer');
  });

  it('a failed job is the one score state drawn in danger', () => {
    render(<ScoreBadge application={{ matchScore: null, aiStatus: 'failed' }} />);

    expect(screen.getByRole('img').className).toContain('text-danger');
  });

  it.each([
    [85, 'bg-accent-tint'],
    [70, 'text-ink-2'],
    [40, 'text-ink-3'],
  ])('a score of %i gets the %s tier look', (matchScore, tierClass) => {
    render(<ScoreBadge application={{ matchScore, aiStatus: 'done' }} />);

    const badge = screen.getByRole('img', { name: `Match Score ${String(matchScore)}` });
    expect(badge.textContent).toBe(String(matchScore));
    expect(badge.className).toContain(tierClass);
  });

  it('a muted badge on a silent card drops the tier fill', () => {
    render(<ScoreBadge application={{ matchScore: 85, aiStatus: null }} view={{ muted: true }} />);

    const badge = screen.getByRole('img', { name: 'Match Score 85' });
    expect(badge.className).toContain('bg-transparent');
    expect(badge.className).not.toContain('bg-accent-tint');
  });
});
