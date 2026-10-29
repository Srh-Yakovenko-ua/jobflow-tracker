import { ApplicationCard } from '@/entities/application';
import { uk } from '@/shared/i18n';

import { CARD_SPECIMENS } from './card-specimens';
import { GallerySection, Specimen } from './gallery';

export function CardsSection() {
  return (
    <GallerySection header={uk.devUi.cards}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] items-start gap-4.5 rounded-2xl bg-surface-3 p-3">
        {CARD_SPECIMENS.map(({ eyebrow, ...card }) => (
          <Specimen key={eyebrow} eyebrow={eyebrow}>
            <ApplicationCard {...card} />
          </Specimen>
        ))}
      </div>
    </GallerySection>
  );
}
