'use client';

import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Checkbox } from '@/shared/ui/checkbox';
import { RadioGroup } from '@/shared/ui/radio-group';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { Switch } from '@/shared/ui/switch';

import { GallerySection, Note, PANEL, Specimen, TILE_GRID } from './gallery';
import { THRESHOLD_DAYS, type ThresholdDays } from './specimen';

const COPY = uk.devUi.choice;

const REJECTION_SIDES = [
  { value: 'company', label: COPY.radios.company },
  { value: 'candidate', label: COPY.radios.mine },
];

const THRESHOLD_OPTIONS = THRESHOLD_DAYS.map((days) => ({
  value: days,
  label: `${days} ${COPY.days}`,
}));

export function ChoiceSection() {
  const [side, setSide] = useState('company');
  const [threshold, setThreshold] = useState<ThresholdDays>('7');
  return (
    <GallerySection header={COPY}>
      <div className={cn(PANEL, TILE_GRID)}>
        <Specimen eyebrow={COPY.checkboxEyebrow} className="gap-0">
          <Checkbox label={COPY.checkboxes.ghosted} defaultChecked />
          <Checkbox label={COPY.checkboxes.weekly} />
          <Checkbox label={COPY.checkboxes.partial} checked="indeterminate" />
          <Checkbox label={COPY.checkboxes.unavailable} disabled />
        </Specimen>
        <Specimen eyebrow={COPY.radioEyebrow} className="gap-0">
          <RadioGroup
            aria-label={COPY.radioLabel}
            options={REJECTION_SIDES}
            value={side}
            onValueChange={setSide}
          />
          <Note>{COPY.radioNote}</Note>
        </Specimen>
        <Specimen eyebrow={COPY.switchEyebrow} className="gap-0">
          <Switch label={COPY.switches.autoGhost} defaultChecked />
          <Switch label={COPY.switches.push} />
        </Specimen>
        <Specimen eyebrow={COPY.thresholdEyebrow}>
          <SegmentedControl
            aria-label={COPY.thresholdLabel}
            options={THRESHOLD_OPTIONS}
            value={threshold}
            onValueChange={setThreshold}
          />
        </Specimen>
      </div>
    </GallerySection>
  );
}
