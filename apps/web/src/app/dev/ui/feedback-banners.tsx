import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Banner } from '@/shared/ui/banner';
import { Button } from '@/shared/ui/button';
import { DashedBars, EmptyState } from '@/shared/ui/empty-state';

import { Specimen, TILE_GRID } from './gallery';

const COPY = uk.devUi.banners;

export function FeedbackBanners() {
  return (
    <Specimen eyebrow={COPY.eyebrow}>
      <div className={cn(TILE_GRID, 'items-start')}>
        <Banner tone="info" content={COPY.insight} />
        <Banner tone="error" content={COPY.offline} />
        <EmptyState
          content={COPY.compactEmpty}
          slots={{
            figure: <DashedBars view={{ density: 'compact' }} />,
            action: <Button size="sm">{COPY.compactEmpty.action}</Button>,
          }}
          view={{ size: 'compact' }}
        />
      </div>
    </Specimen>
  );
}
