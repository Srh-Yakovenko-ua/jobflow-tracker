import {
  APPLICATION_FORMS_UK,
  countedUk,
  DAY_FORMS_UK,
  type NotifiedAiKind,
  type PluralForms,
  pluralUk,
} from '@jobflow/shared';

import { FORMS } from './analytics-forms';
import { shell } from './shell';

const BRING_CLOSER = { one: 'наблизить', other: 'наблизять' } as const satisfies PluralForms;

type RhythmWeekCounts = Readonly<{ applications: number; followups: number }>;

type RhythmSuggestion = Readonly<{ goal: number; weeksSooner: number }>;

const SILENT_CARDS = {
  one: 'картка в тиші',
  few: 'картки в тиші',
  other: 'карток у тиші',
} as const satisfies PluralForms;

const SILENT_COMPANIES = {
  one: 'компанія мовчить',
  few: 'компанії мовчать',
  other: 'компаній мовчать',
} as const satisfies PluralForms;

const UNREAD = {
  one: 'непрочитане',
  few: 'непрочитані',
  other: 'непрочитаних',
} as const satisfies PluralForms;

const AI_RETRY = 'Дані на місці, можна спробувати ще раз.';

const OPEN_CARD = 'Відкрити картку';

type AiCopy = { title: string; text: string; action: string };

export const notifications = {
  title: 'Сповіщення',
  bell: (unread: number) =>
    unread === 0 ? 'Сповіщення' : `Сповіщення, ${countedUk(unread, UNREAD)}`,
  popoverTitle: (unread: number) => `Сповіщення · ${String(unread)}`,
  readAll: 'Прочитати все',
  all: 'Усі сповіщення',
  unread: 'непрочитане',
  markRead: 'Позначити прочитаним',
  popoverEmpty: 'Нових сповіщень немає.',
  filters: {
    label: 'Які сповіщення показати',
    options: { all: 'Усі', unread: 'Непрочитані' },
  },
  more: 'Показати ще',
  days: { today: 'Сьогодні', yesterday: 'Вчора' },
  open: 'Відкрити',
  silentCards: (count: number) => countedUk(count, SILENT_CARDS),
  empty: {
    eyebrow: 'Нічого нового',
    title: 'Усі відповіли',
    hint: (silenceDays: number) =>
      `Жодна картка не мовчить довше ${countedUk(silenceDays, DAY_FORMS_UK)}.`,
  },
  silence: {
    text: (companies: string, days: number) =>
      `${companies} · ${countedUk(days, DAY_FORMS_UK)} без відповіді`,
    action: shell.palette.actions.followUp,
  },
  autoGhosted: {
    title: (count: number, days: number) =>
      `${countedUk(count, SILENT_COMPANIES)} понад ${countedUk(days, DAY_FORMS_UK)}, перенесено в ghosted`,
    action: shell.shortcuts.items.board,
  },
  interviewSoon: {
    title: (clock: string) => `Співбесіда о ${clock}`,
    action: OPEN_CARD,
  },
  interviewPrepReady: { text: 'Підготовка готова', action: OPEN_CARD },
  aiDone: {
    vacancy_parse: {
      title: 'Вакансію розібрано',
      text: 'Перевір поля перед збереженням.',
      action: 'Перевірити поля',
    },
    resume_parse: {
      title: 'Резюме розібрано',
      text: 'Нова версія вже у списку резюме.',
      action: 'Відкрити резюме',
    },
    followup: {
      title: 'Фоллоу-ап готовий',
      text: 'Його можна правити перед відправкою.',
      action: 'Відкрити лист',
    },
  } satisfies Record<NotifiedAiKind, AiCopy>,
  aiFailed: {
    vacancy_parse: {
      title: 'Не вдалося розібрати вакансію',
      text: AI_RETRY,
      action: 'Заповнити вручну',
    },
    resume_parse: {
      title: 'Не вдалося розібрати резюме',
      text: AI_RETRY,
      action: 'Відкрити резюме',
    },
    followup: {
      title: 'Не вдалося написати фоллоу-ап',
      text: AI_RETRY,
      action: shell.palette.actions.followUp,
    },
  } satisfies Record<NotifiedAiKind, AiCopy>,
  insightUnlocked: {
    title: 'Перші висновки готові',
    text: (applications: number) =>
      `У статистиці вже ${countedUk(applications, APPLICATION_FORMS_UK)}.`,
    action: shell.palette.actions.analytics,
  },
  monthlySummaryReady: {
    title: (month: string) => `Саммарі за ${month} готове`,
    text: 'Що вийшло за місяць і які кроки зробити далі.',
    action: shell.palette.actions.analytics,
  },
  exportReady: {
    title: 'Архів з даними готовий',
    text: (format: string) => `Архів ${format} чекає в налаштуваннях акаунта.`,
    action: 'Завантажити архів',
  },
  rhythmWeekClosed: {
    title: ({ applications, followups }: RhythmWeekCounts) =>
      `Тиждень закрито: ${countedUk(applications, APPLICATION_FORMS_UK)} і ${countedUk(followups, FORMS.followup)}`,
    inRhythm: 'Ти у ритмі.',
    nextWeek: 'Наступний тиждень, новий старт.',
    suggestion: ({ goal, weeksSooner }: RhythmSuggestion) =>
      `${countedUk(goal, APPLICATION_FORMS_UK)} на тиждень ${pluralUk(goal, BRING_CLOSER)} офер приблизно на ${countedUk(weeksSooner, FORMS.week)}.`,
    action: shell.palette.actions.analytics,
  },
} as const;
