'use client';

import {
  FOLLOWUP_LANGUAGES,
  FOLLOWUP_TONES,
  type FollowupRequest,
  type FollowupRequestInput,
} from '@jobflow/shared';
import { Controller, type UseFormReturn } from 'react-hook-form';

import { uk } from '@/shared/i18n';
import { SegmentedControl } from '@/shared/ui/segmented-control';

export type FollowupMethods = UseFormReturn<FollowupRequestInput, unknown, FollowupRequest>;

export type FollowupChoicesProps = Readonly<{ methods: FollowupMethods }>;

const COPY = uk.followup;

const TONE_OPTIONS = FOLLOWUP_TONES.map((value) => ({ value, label: COPY.tone.options[value] }));

const LANGUAGE_OPTIONS = FOLLOWUP_LANGUAGES.map((value) => ({
  value,
  label: COPY.language.options[value],
}));

export function FollowupChoices({ methods }: FollowupChoicesProps) {
  const { control } = methods;
  return (
    <div className="flex flex-wrap gap-2">
      <Controller
        control={control}
        name="tone"
        render={({ field }) => (
          <SegmentedControl
            aria-label={COPY.tone.label}
            options={TONE_OPTIONS}
            value={field.value}
            onValueChange={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="language"
        render={({ field }) => (
          <SegmentedControl
            aria-label={COPY.language.label}
            options={LANGUAGE_OPTIONS}
            value={field.value}
            onValueChange={field.onChange}
          />
        )}
      />
    </div>
  );
}
