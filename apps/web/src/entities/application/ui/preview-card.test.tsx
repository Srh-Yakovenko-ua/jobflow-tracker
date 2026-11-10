import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { REVIEW_DRAFT } from '@/test/application-fixtures';

import { PreviewCard } from './preview-card';

describe('PreviewCard', () => {
  it('shows a draft under перевір поля, ringed in accent, with its position, company, salary and source', () => {
    render(<PreviewCard application={REVIEW_DRAFT} />);

    expect(screen.getByText('перевір поля')).toBeDefined();
    expect(screen.getByRole('article').className).toContain('inset-ring-accent');
    expect(screen.getByText('Senior React developer')).toBeDefined();
    expect(screen.getByText('Acme')).toBeDefined();
    expect(screen.getByText('$4 700–5 900')).toBeDefined();
    expect(screen.getByText('інше')).toBeDefined();
    expect(screen.getByRole('img', { name: 'без CV' })).toBeDefined();
  });

  it('drops the перевір поля mark and the ring once the draft is confirmed, and shows its Match Score', () => {
    render(<PreviewCard application={{ ...REVIEW_DRAFT, isDraft: false, matchScore: 84 }} />);

    expect(screen.queryByText('перевір поля')).toBeNull();
    expect(screen.getByRole('article').className).not.toContain('inset-ring-accent');
    expect(screen.getByRole('img', { name: 'Match Score 84' })).toBeDefined();
  });
});
