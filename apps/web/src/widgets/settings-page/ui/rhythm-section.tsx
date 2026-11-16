'use client';

import { localDateOf, USER_SETTINGS_LIMITS, type UserSettings } from '@jobflow/shared';

import { useUpdateSettingsMutation } from '@/features/update-settings';
import { uk } from '@/shared/i18n';
import { addDays } from '@/shared/lib/calendar-month';
import { DateField } from '@/shared/ui/date-field';
import { Field } from '@/shared/ui/field';
import { NumberInput } from '@/shared/ui/number-input';
import { Reveal } from '@/shared/ui/reveal';

import { SaveStatus } from './save-status';
import { SettingSwitch } from './setting-rows';
import {
  SettingsBlock,
  SettingsCard,
  type SettingsControlProps,
  SettingsSection,
} from './settings-frame';

export type RhythmSectionProps = Readonly<{ settings: UserSettings }>;

const COPY = uk.rhythm.settings;

const STARTING_GOAL = 5;

const PAUSE_DAYS = 7;

const GOAL_RANGE = USER_SETTINGS_LIMITS.weeklyGoal;

const FOLLOWUP_RANGE = { min: 0, max: GOAL_RANGE.max };

const ROWS = 'divide-y divide-line-soft';

function GoalFields({ settings, onSave }: SettingsControlProps) {
  const applications = settings.weeklyGoalApplications ?? STARTING_GOAL;
  const followups = settings.weeklyGoalFollowups ?? 0;
  return (
    <div className="flex flex-wrap gap-4 px-5 py-4">
      <div className="w-56 max-w-full">
        <Field label={COPY.applications}>
          <NumberInput
            value={applications}
            range={GOAL_RANGE}
            onValueChange={(weeklyGoalApplications) => {
              if (weeklyGoalApplications !== applications) onSave({ weeklyGoalApplications });
            }}
          />
        </Field>
      </div>
      <div className="w-56 max-w-full">
        <Field label={COPY.followups} footer={{ hint: COPY.followupsHint }}>
          <NumberInput
            value={followups}
            range={FOLLOWUP_RANGE}
            onValueChange={(next) => {
              if (next !== followups) onSave({ weeklyGoalFollowups: next === 0 ? null : next });
            }}
          />
        </Field>
      </div>
    </div>
  );
}

function PauseControls({ settings, onSave }: SettingsControlProps) {
  const today = localDateOf(settings, new Date());
  const { pausedUntil } = settings;
  const returnDay = pausedUntil !== null && pausedUntil >= today ? pausedUntil : null;
  return (
    <div>
      <SettingSwitch
        copy={COPY.pause}
        checked={returnDay !== null}
        onCheckedChange={(paused) => {
          onSave({ pausedUntil: paused ? addDays(today, PAUSE_DAYS) : null });
        }}
      />
      <Reveal shown={returnDay !== null}>
        <div className="max-w-sm px-5 pb-4">
          <Field label={COPY.returnDate}>
            <DateField
              selection={{
                value: returnDay,
                onSelect: (day) => {
                  if (day !== returnDay) onSave({ pausedUntil: day });
                },
              }}
              days={{ today, min: today }}
            />
          </Field>
        </div>
      </Reveal>
    </div>
  );
}

export function RhythmSection({ settings }: RhythmSectionProps) {
  const { save, status } = useUpdateSettingsMutation();
  const goalOn = settings.weeklyGoalApplications !== null;
  return (
    <SettingsSection id="rhythm">
      <SettingsBlock
        heading={{ title: uk.settings.sections.rhythm, description: COPY.description }}
        status={<SaveStatus status={status} />}
      >
        <SettingsCard className={ROWS}>
          <SettingSwitch
            copy={COPY.goal}
            checked={goalOn}
            onCheckedChange={(on) => {
              save({
                weeklyGoalApplications: on ? (settings.suggestedWeeklyGoal ?? STARTING_GOAL) : null,
              });
            }}
          />
          <Reveal shown={goalOn} className={ROWS}>
            <GoalFields settings={settings} onSave={save} />
            <PauseControls settings={settings} onSave={save} />
          </Reveal>
        </SettingsCard>
      </SettingsBlock>
    </SettingsSection>
  );
}
