import { type ApplicationResponse, DRAFT_PLACEHOLDERS } from '@jobflow/shared';

import { ApplicationCard, FULL_APPLICATION, PreviewCard } from '@/entities/application';
import { uk } from '@/shared/i18n';

import { CARD_SPECIMENS } from './card-specimens';
import { GallerySection, Specimen } from './gallery';

const FAILED_PREVIEW: ApplicationResponse = {
  ...FULL_APPLICATION,
  ...DRAFT_PLACEHOLDERS,
  id: '0b6f3c1e-5d2a-4c8e-9f10-000000000013',
  isDraft: true,
  matchScore: null,
};

export function CardsSection() {
  return (
    <GallerySection header={uk.devUi.cards}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] items-start gap-4.5 rounded-2xl bg-surface-3 p-3">
        {CARD_SPECIMENS.map(({ eyebrow, ...card }) => (
          <Specimen key={eyebrow} eyebrow={eyebrow}>
            <ApplicationCard {...card} />
          </Specimen>
        ))}
        <Specimen eyebrow={uk.devUi.cards.preview}>
          <PreviewCard application={FAILED_PREVIEW} view={{ mark: 'failed' }} />
        </Specimen>
      </div>
    </GallerySection>
  );
}
