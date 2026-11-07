import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';

type CompilerRuntime = { c: (size: number) => unknown[] };

const memoCache = vi.hoisted(() => vi.fn<CompilerRuntime['c']>());

vi.mock('react/compiler-runtime', async (importOriginal) => {
  const actual = await importOriginal<CompilerRuntime>();
  memoCache.mockImplementation(actual.c);
  return { ...actual, c: memoCache };
});

const LABEL = uk.devUi.buttons.addVacancy;

describe('React Compiler', () => {
  it('a button from src renders through the React Compiler cache, as next build ships it', () => {
    render(<Button>{LABEL}</Button>);

    expect(screen.getByRole('button', { name: LABEL })).toBeTruthy();
    expect(memoCache).toHaveBeenCalled();
  });
});
