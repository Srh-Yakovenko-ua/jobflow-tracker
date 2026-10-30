import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { vi } from 'vitest';

import type { ErrorPageProps } from '@/shared/ui/page-crash';

export const CRASH_SECRET = 'connect ECONNREFUSED 10.0.0.7:5432 as jobflow';

export function renderCrashedPage(Page: ComponentType<ErrorPageProps>) {
  const retry = vi.fn();
  const error = Object.assign(new Error(CRASH_SECRET), { digest: '3f9a1c27' });
  render(<Page error={error} unstable_retry={retry} />);
  return { retry, user: userEvent.setup() };
}
