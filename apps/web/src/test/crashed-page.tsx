import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { vi } from 'vitest';

import type { ErrorPageProps } from '@/shared/ui/page-crash';

export const CRASH_SECRET = 'connect ECONNREFUSED 10.0.0.7:5432 as jobflow';

const CODE_IN_META = /^код ([0-9a-f]{8}) · /;

export function shownCrashCode(): string {
  const meta = screen.getByText(CODE_IN_META);
  return CODE_IN_META.exec(meta.textContent)?.[1] ?? '';
}

export function renderCrashedPage(Page: ComponentType<ErrorPageProps>) {
  const retry = vi.fn();
  const error = Object.assign(new Error(CRASH_SECRET), { digest: '2349875623' });
  render(<Page error={error} unstable_retry={retry} />);
  return { retry, user: userEvent.setup() };
}
