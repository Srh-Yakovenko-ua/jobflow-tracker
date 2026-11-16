import { APPLICATION_FORMS_UK, countedUk, type PluralForms, pluralUk } from '@jobflow/shared';

import { FORMS } from './analytics-forms';

const OF_APPLICATIONS = { one: 'відгуку', other: 'відгуків' } as const satisfies PluralForms;

const OF_FOLLOWUPS = { one: 'фоллоу-апу', other: 'фоллоу-апів' } as const satisfies PluralForms;

const OF_RECENT_WEEKS = {
  one: 'останнього тижня',
  other: 'останніх тижнів',
} as const satisfies PluralForms;

const THIS_WEEK = 'Цей тиждень';

export type RhythmProgress = Readonly<{ done: number; goal: number }>;

export type RhythmSentence = Readonly<{ status: string; inRhythm: number; weeks: number }>;

export const rhythm = {
  applications: ({ done, goal }: RhythmProgress) =>
    `${String(done)} із ${String(goal)} ${pluralUk(goal, OF_APPLICATIONS)}`,
  followups: (done: number) => countedUk(done, FORMS.followup),
  followupsOfGoal: ({ done, goal }: RhythmProgress) =>
    `${String(done)} із ${String(goal)} ${pluralUk(goal, OF_FOLLOWUPS)}`,
  line: (parts: readonly string[]) => `${THIS_WEEK}: ${parts.join(' · ')}`,
  spokenLine: (parts: readonly string[]) => `${THIS_WEEK}: ${parts.join(', ')}`,
  paused: (day: string) => `Пауза до ${day}`,
  sentence: ({ status, inRhythm, weeks }: RhythmSentence) =>
    `${status}; у ритмі ${String(inRhythm)} з ${String(weeks)} ${pluralUk(weeks, OF_RECENT_WEEKS)}.`,
  popover: {
    title: 'Ритм тижня',
    goal: (goal: number) => `Нова ціль: ${countedUk(goal, APPLICATION_FORMS_UK)} на тиждень`,
    accept: 'Прийняти ціль',
    later: 'Не зараз',
    configure: 'Налаштувати ритм',
  },
  settings: {
    description: 'Невелика ціль на тиждень і спокійний індикатор темпу на дошці.',
    goal: {
      title: 'Тижнева ціль',
      description: 'Скільки відгуків на тиждень тримає пошук у русі.',
    },
    applications: 'Відгуків на тиждень',
    followups: 'Фоллоу-апів на тиждень',
    followupsHint: '0 означає, що ціль на фоллоу-апи не потрібна.',
    pause: {
      title: 'Пауза',
      description: 'Відпустка чи хвороба: тижні паузи не рвуть серію.',
    },
    returnDate: 'Дата повернення',
  },
} as const;
