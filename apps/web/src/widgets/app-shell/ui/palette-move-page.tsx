'use client';

import { type Stage, STAGE_LABELS } from '@jobflow/shared';

import { type MovingApplication, StageMarker } from '@/entities/application';
import { uk } from '@/shared/i18n';

import { legalMovesFrom } from '../model/palette-commands';
import { PaletteGroup, PaletteRow } from './palette-row';

export type PaletteMovePageProps = Readonly<{
  application: MovingApplication;
  onMove: (toStage: Stage) => void;
}>;

export function PaletteMovePage({ application, onMove }: PaletteMovePageProps) {
  return (
    <PaletteGroup label={uk.shell.palette.groups.stages}>
      {legalMovesFrom(application.currentStage).map((stage) => (
        <PaletteRow
          key={stage}
          item={{
            value: `stage:${stage}`,
            label: STAGE_LABELS[stage].labelUk,
            leading: <StageMarker stage={stage} />,
          }}
          onSelect={() => {
            onMove(stage);
          }}
        />
      ))}
    </PaletteGroup>
  );
}
