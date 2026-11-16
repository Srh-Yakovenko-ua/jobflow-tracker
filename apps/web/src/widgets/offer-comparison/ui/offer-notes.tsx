'use client';

import { uk } from '@/shared/i18n';
import { Field } from '@/shared/ui/field';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { Textarea } from '@/shared/ui/textarea';

import { COMPARISON_LIMITS, type OfferNotes } from '../model/comparison-store';
import { BenefitsChecklist, BenefitsList } from './benefits-checklist';

const COPY = uk.offerCompare.column;

const LABEL = 'label text-ink';

const RATING_OPTIONS = Array.from(
  { length: COMPARISON_LIMITS.ratingMax - COMPARISON_LIMITS.ratingMin + 1 },
  (_, step) => {
    const rating = String(COMPARISON_LIMITS.ratingMin + step);
    return { value: rating, label: rating };
  },
);

type NoteField = 'notes' | 'growthNote';

export type OfferNotesBinding = Readonly<{
  value: OfferNotes;
  onChange: (patch: Partial<OfferNotes>) => void;
}>;

export type OfferNotesProps = Readonly<{ notes: OfferNotesBinding }>;

function NoteArea({ notes, field }: OfferNotesProps & Readonly<{ field: NoteField }>) {
  return (
    <Field label={COPY[field]}>
      <Textarea
        value={notes.value[field]}
        maxLength={COMPARISON_LIMITS.noteMaxLength}
        className="min-h-20"
        onChange={(event) => {
          notes.onChange({ [field]: event.currentTarget.value });
        }}
      />
    </Field>
  );
}

export function OfferNotesFields({ notes }: OfferNotesProps) {
  const { value, onChange } = notes;
  return (
    <>
      <NoteArea notes={notes} field="notes" />
      <BenefitsChecklist
        benefits={value.benefits}
        onChange={(benefits) => {
          onChange({ benefits });
        }}
      />
      <NoteArea notes={notes} field="growthNote" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <span aria-hidden className={LABEL}>
          {COPY.growthRating}
        </span>
        <SegmentedControl
          aria-label={COPY.growthRating}
          options={RATING_OPTIONS}
          value={value.growthRating === null ? '' : String(value.growthRating)}
          onValueChange={(rating) => {
            onChange({ growthRating: Number(rating) });
          }}
        />
      </div>
    </>
  );
}

type NoteTextProps = Readonly<{ label: string; text: string }>;

function NoteText({ label, text }: NoteTextProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={LABEL}>{label}</span>
      <p className="text-[13px] leading-[1.5] wrap-break-word whitespace-pre-line text-ink-2">
        {text === '' ? COPY.unknown : text}
      </p>
    </div>
  );
}

export type OfferNotesTextProps = Readonly<{ notes: OfferNotes }>;

export function OfferNotesText({ notes }: OfferNotesTextProps) {
  const rating = notes.growthRating === null ? '' : COPY.rating(notes.growthRating);
  return (
    <>
      <NoteText label={COPY.notes} text={notes.notes} />
      <BenefitsList benefits={notes.benefits} />
      <NoteText label={COPY.growthNote} text={notes.growthNote} />
      <NoteText label={COPY.growthRating} text={rating} />
    </>
  );
}
