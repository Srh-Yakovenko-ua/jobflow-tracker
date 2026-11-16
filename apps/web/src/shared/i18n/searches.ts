import {
  APPLICATION_FORMS_UK,
  countedUk,
  DAY_FORMS_UK,
  type OpenApplicationChoice,
  type PluralForms,
  type SearchOutcome,
  type SearchSummary,
} from '@jobflow/shared';

import { FORMS } from './analytics-forms';

const INTERVIEW_FORMS = {
  one: 'співбесіда',
  few: 'співбесіди',
  other: 'співбесід',
} as const satisfies PluralForms;

export type SearchStats = Readonly<Pick<SearchSummary, 'days' | 'applications' | 'interviews'>>;

export type SearchComparison = Readonly<{
  previous: SearchStats & Readonly<Pick<SearchSummary, 'daysToOffer'>>;
  current: SearchStats;
}>;

const stats = ({ days, applications, interviews }: SearchStats) =>
  [
    countedUk(days, DAY_FORMS_UK),
    countedUk(applications, APPLICATION_FORMS_UK),
    countedUk(interviews, INTERVIEW_FORMS),
  ].join(', ');

const daysToOffer = (days: number | null) =>
  days === null ? 'без оферу' : `офер на ${String(days)}-й день`;

export const searches = {
  stats,
  finish: {
    action: 'Офер прийнято',
    eyebrow: 'Пошук завершено',
    title: 'Офер прийнято',
    hint: (search: SearchStats) =>
      `${stats(search)}. Дошку можна заархівувати. Аналітика залишиться, вона знадобиться наступного разу.`,
    choice: {
      label: 'Що зробити з відкритими відгуками',
      options: {
        withdraw: 'Відкликати всі відкриті відгуки, цього не можна скасувати',
        move: 'Перенести в новий пошук',
      } satisfies Record<OpenApplicationChoice, string>,
    },
    confirm: 'Заархівувати пошук',
    cancel: 'Скасувати',
    archived: { title: 'Пошук заархівовано', action: 'Історія пошуків' },
    conflict: { title: 'Цей пошук уже завершено', description: 'Онови сторінку.' },
  },
  history: {
    title: 'Історія пошуків',
    outcomes: {
      offer_accepted: 'офер прийнято',
      paused: 'на паузі',
      other: 'інша причина',
    } satisfies Record<SearchOutcome, string>,
    days: (count: number) => countedUk(count, DAY_FORMS_UK),
    applications: (count: number) => countedUk(count, APPLICATION_FORMS_UK),
    interviews: (count: number) => countedUk(count, INTERVIEW_FORMS),
    offers: (count: number) => countedUk(count, FORMS.offer),
    daysToOffer,
    dashboard: 'Дашборд',
    empty: {
      title: 'Завершених пошуків ще немає',
      hint: 'Коли завершиш пошук, він залишиться тут разом зі своїм дашбордом.',
    },
  },
  comparison: ({ previous, current }: SearchComparison) =>
    `Минулий пошук: ${stats(previous)}, ${daysToOffer(previous.daysToOffer)} · зараз: ${stats(current)}`,
} as const;
