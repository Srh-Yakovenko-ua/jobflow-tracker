import { ScoreBadge } from '@/entities/application';
import { uk } from '@/shared/i18n';

import { SCORE_SPECIMENS } from './card-specimens';
import { GallerySection, Note, PANEL, Specimen } from './gallery';

const COPY = uk.devUi.matchScore;

export function ScoreSection() {
  return (
    <GallerySection header={COPY}>
      <div className={PANEL}>
        <Specimen eyebrow={COPY.eyebrow}>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3.5">
            {SCORE_SPECIMENS.map((specimen) => (
              <li key={specimen.caption} className="flex items-center gap-2.5">
                <ScoreBadge application={specimen.application} />
                <span className="caption text-ink-3">{specimen.caption}</span>
              </li>
            ))}
          </ul>
          <Note>{COPY.note}</Note>
        </Specimen>
      </div>
    </GallerySection>
  );
}
