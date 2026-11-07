import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';

export type LoadingRegionProps = Readonly<{ className?: string; children?: ReactNode }>;

export function LoadingRegion({ className, children }: LoadingRegionProps) {
  return (
    <div aria-busy="true" className={className}>
      <p role="status" className="sr-only">
        {uk.ui.loading}
      </p>
      {children}
    </div>
  );
}
