'use client';

import { Plus, Star } from 'lucide-react';
import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button, type ButtonSize, type ButtonVariant } from '@/shared/ui/button';
import { SegmentedControl } from '@/shared/ui/segmented-control';

import { Divider, GallerySection, PANEL, Specimen } from './gallery';

const COPY = uk.devUi.buttons;

const SIZES: readonly ButtonSize[] = ['xs', 'sm', 'md', 'lg'];

const VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger'];

const PERIODS = [
  { value: 'all', label: COPY.periods.all },
  { value: 'month', label: COPY.periods.month },
  { value: 'week', label: COPY.periods.week },
] as const;

type Period = (typeof PERIODS)[number]['value'];

const ROW = 'flex flex-wrap items-center gap-2.5';

function IconButtons() {
  const [favourite, setFavourite] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        icon={<Plus aria-hidden />}
        aria-label={COPY.addVacancy}
      />
      <Button
        variant="secondary"
        size="sm"
        icon={<Star aria-hidden className={cn(favourite && 'fill-current text-accent-press')} />}
        aria-label={COPY.favourite}
        aria-pressed={favourite}
        onClick={() => {
          setFavourite(!favourite);
        }}
      />
    </div>
  );
}

export function ButtonsSection() {
  const [period, setPeriod] = useState<Period>('month');
  return (
    <GallerySection header={COPY}>
      <div className={PANEL}>
        <Specimen eyebrow={COPY.sizesEyebrow}>
          <div className={ROW}>
            {SIZES.map((size) => (
              <Button key={size} size={size}>
                {COPY.sizes[size]}
              </Button>
            ))}
          </div>
        </Specimen>
        <Divider />
        <Specimen eyebrow={COPY.variantsEyebrow}>
          <div className={ROW}>
            {VARIANTS.map((variant) => (
              <Button key={variant} variant={variant}>
                {COPY.variants[variant]}
              </Button>
            ))}
            <Button disabled>{COPY.variants.disabled}</Button>
            <Button loading>{COPY.variants.loading}</Button>
          </div>
        </Specimen>
        <Divider />
        <div className="flex flex-wrap items-end gap-6.5">
          <Specimen eyebrow={COPY.iconEyebrow}>
            <IconButtons />
          </Specimen>
          <Specimen eyebrow={COPY.segmentsEyebrow}>
            <SegmentedControl
              aria-label={COPY.periodLabel}
              options={PERIODS}
              value={period}
              onValueChange={setPeriod}
            />
          </Specimen>
        </div>
      </div>
    </GallerySection>
  );
}
