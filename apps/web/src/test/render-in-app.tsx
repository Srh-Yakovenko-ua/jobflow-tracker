import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { Providers } from '@/app/providers';

export function renderInApp(ui: ReactNode) {
  render(<Providers theme="light">{ui}</Providers>);
  return userEvent.setup();
}
