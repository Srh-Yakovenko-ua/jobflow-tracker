import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FAILED_DRAFT, REVIEW_DRAFT } from '@/test/application-fixtures';

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

  it('shows a draft whose parse failed under потрібні поля, ringed in terracotta, with the kept text line instead of the footer', () => {
    render(<PreviewCard application={FAILED_DRAFT} view={{ mark: 'failed' }} />);

    expect(screen.getByText('потрібні поля')).toBeDefined();
    expect(screen.getByText('текст збережено в нотатці')).toBeDefined();
    expect(screen.getByRole('article').className).toContain('inset-ring-rejected');
    expect(screen.getByText('Без назви')).toBeDefined();
    expect(screen.getByText('компанію не розпізнано')).toBeDefined();
    expect(screen.queryByText('перевір поля')).toBeNull();
    expect(screen.queryByText('вилка не вказана')).toBeNull();
  });

  it('drops the перевір поля mark and the ring once the draft is confirmed, and shows its Match Score', () => {
    render(<PreviewCard application={{ ...REVIEW_DRAFT, isDraft: false, matchScore: 84 }} />);

    expect(screen.queryByText('перевір поля')).toBeNull();
    expect(screen.getByRole('article').className).not.toContain('inset-ring-accent');
    expect(screen.getByRole('img', { name: 'Match Score 84' })).toBeDefined();
  });
});
