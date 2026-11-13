import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { stubMotionPreference } from '@/test/motion-preference';

import { useDataTransition } from './use-data-transition';

describe('useDataTransition', () => {
  it('grows data over the 820 ms data token on the standard curve', () => {
    stubMotionPreference('no-preference');

    const { result } = renderHook(useDataTransition);

    expect(result.current).toEqual({ duration: 0.82, ease: [0.2, 0.8, 0.3, 1] });
  });

  it('stands still when the user asks for reduced motion', () => {
    stubMotionPreference('reduce');

    const { result } = renderHook(useDataTransition);

    expect(result.current).toEqual({ duration: 0 });
  });
});
