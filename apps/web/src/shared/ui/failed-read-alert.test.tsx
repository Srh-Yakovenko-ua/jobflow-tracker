import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';
import type { SectionLoad } from '@/shared/lib/section-load';

import { FailedReadAlert } from './failed-read-alert';

const RETRY = { name: uk.states.errors.loadFailed.action };

const SETTLED: SectionLoad = {
  pending: false,
  busy: false,
  failed: false,
  stale: false,
  retrying: false,
  onRetry: vi.fn(),
};

describe('FailedReadAlert', () => {
  it('stays out of the way while the read is fine', () => {
    render(<FailedReadAlert load={SETTLED} />);

    expect(screen.queryByRole('button', RETRY)).toBeNull();
  });

  it('a failed read offers a retry that asks again', async () => {
    const onRetry = vi.fn();
    render(<FailedReadAlert load={{ ...SETTLED, failed: true, onRetry }} />);

    await userEvent.click(screen.getByRole('button', RETRY));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('the retry button is busy while the read is asked again', () => {
    render(<FailedReadAlert load={{ ...SETTLED, failed: true, retrying: true }} />);

    expect(screen.getByRole('button', { ...RETRY, busy: true })).toBeDefined();
  });
});
