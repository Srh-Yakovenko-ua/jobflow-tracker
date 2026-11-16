'use client';

import { Check } from 'lucide-react';

import { uk } from '@/shared/i18n';
import { Checkbox } from '@/shared/ui/checkbox';

import { OFFER_BENEFITS, type OfferNotes } from '../model/comparison-store';

const COPY = uk.offerCompare.column;

const LEGEND = 'label mb-1.5 text-ink';

type Benefits = OfferNotes['benefits'];

export type BenefitsChecklistProps = Readonly<{
  benefits: Benefits;
  onChange: (benefits: Benefits) => void;
}>;

export function BenefitsChecklist({ benefits, onChange }: BenefitsChecklistProps) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className={LEGEND}>{COPY.benefits}</legend>
      {OFFER_BENEFITS.map((benefit) => (
        <Checkbox
          key={benefit}
          label={<span className="text-[13px] text-ink">{COPY.benefit[benefit]}</span>}
          checked={benefits[benefit]}
          onCheckedChange={(checked) => {
            onChange({ ...benefits, [benefit]: checked === true });
          }}
        />
      ))}
    </fieldset>
  );
}

export type BenefitsListProps = Readonly<{ benefits: Benefits }>;

export function BenefitsList({ benefits }: BenefitsListProps) {
  const ticked = OFFER_BENEFITS.filter((benefit) => benefits[benefit]);
  return (
    <div className="flex min-w-0 flex-col">
      <span className={LEGEND}>{COPY.benefits}</span>
      {ticked.length === 0 ? (
        <span className="text-[13px] text-ink-3">{COPY.noBenefits}</span>
      ) : (
        <ul className="flex flex-col gap-1 text-[13px] text-ink">
          {ticked.map((benefit) => (
            <li key={benefit} className="flex items-center gap-1.5">
              <Check aria-hidden size={16} strokeWidth={1.9} className="flex-none text-accent" />
              {COPY.benefit[benefit]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
