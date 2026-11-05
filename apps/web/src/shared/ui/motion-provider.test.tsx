import { act, render, screen } from '@testing-library/react';
import { MotionConfigContext } from 'motion/react';
import { use } from 'react';
import { describe, expect, it } from 'vitest';

import { stubMotionPreference } from '@/test/motion-preference';

import { MotionProvider } from './motion-provider';

const STILL = '{"reducedMotion":"user","transition":{"duration":0}}';

function MotionSettings() {
  const { reducedMotion, transition } = use(MotionConfigContext);
  return <output>{JSON.stringify({ reducedMotion, transition })}</output>;
}

function renderMotion() {
  render(
    <MotionProvider>
      <MotionSettings />
    </MotionProvider>,
  );
  return () => screen.getByRole('status').textContent;
}

describe('MotionProvider', () => {
  it('with reduced motion asked for in the OS, every Motion animation takes zero time', () => {
    stubMotionPreference('reduce');

    const settings = renderMotion();

    expect(settings()).toBe(STILL);
  });

  it('without that preference, Motion animations run at the base token with the standard easing', () => {
    stubMotionPreference('no-preference');

    const settings = renderMotion();

    expect(settings()).toBe(
      '{"reducedMotion":"user","transition":{"duration":0.2,"ease":[0.2,0.8,0.3,1]}}',
    );
  });

  it('turning reduced motion on while the page is open stops Motion without a reload', () => {
    stubMotionPreference('no-preference');
    const settings = renderMotion();

    act(() => {
      stubMotionPreference('reduce');
    });

    expect(settings()).toBe(STILL);
  });
});
