import { ACTIVE_STAGES, INACTIVE_STAGES } from '@jobflow/shared';

import { OutcomeBadge, StageChip } from '@/entities/application';
import { uk } from '@/shared/i18n';

import { GallerySection, Note, PANEL, Specimen } from './gallery';

const COPY = uk.devUi.stages;

export function StagesSection() {
  return (
    <GallerySection header={COPY}>
      <div className={PANEL}>
        <Specimen eyebrow={COPY.stagesEyebrow}>
          <div className="flex flex-wrap gap-2.5">
            {ACTIVE_STAGES.map((stage) => (
              <StageChip key={stage} stage={stage} />
            ))}
          </div>
        </Specimen>
        <Specimen eyebrow={COPY.outcomesEyebrow}>
          <div className="flex flex-wrap gap-2.5">
            {INACTIVE_STAGES.map((outcome) => (
              <OutcomeBadge key={outcome} outcome={outcome} />
            ))}
          </div>
        </Specimen>
        <Note>{COPY.note}</Note>
      </div>
    </GallerySection>
  );
}
